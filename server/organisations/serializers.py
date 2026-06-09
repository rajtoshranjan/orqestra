from rest_framework import serializers

from accounts.models import User
from utils.encryption import decrypt_val, encrypt_val

from .helpers import get_active_organisation
from .models import AuditLog, AWSAccount, Organisation, OrganisationMember


class OrganisationSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    owner_email = serializers.EmailField(source="owner.email", read_only=True)
    owner_name = serializers.CharField(source="owner.name", read_only=True)

    class Meta:
        model = Organisation
        fields = [
            "id",
            "name",
            "role",
            "owner_email",
            "owner_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "role",
            "owner_email",
            "owner_name",
            "created_at",
            "updated_at",
        ]

    def get_role(self, organisation: Organisation):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None

        if request.user == organisation.owner:
            return "owner"

        member = organisation.members.filter(user=request.user).first()
        return member.role if member else None

    def create(self, validated_data):
        validated_data["owner"] = self.context.get("request").user
        return super().create(validated_data)


class OrganisationMemberSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(write_only=True)
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_name = serializers.CharField(source="user.name", read_only=True)

    class Meta:
        model = OrganisationMember
        fields = ["id", "organisation", "role", "email", "user_email", "user_name"]
        read_only_fields = ["id", "organisation", "user_email", "user_name"]

    def create(self, validated_data):
        email = validated_data.pop("email")
        request = self.context.get("request")

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise serializers.ValidationError({"email": "User not found"})

        if user == request.user:
            raise serializers.ValidationError(
                {"email": "You cannot add yourself to the organisation"}
            )

        active_org = get_active_organisation(request)
        if active_org.owner == user or active_org.members.filter(user=user).exists():
            raise serializers.ValidationError(
                {"email": "User is already a member of this organisation"}
            )

        validated_data["user"] = user
        validated_data["organisation"] = active_org
        return super().create(validated_data)


class AuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(source="actor.email", read_only=True)
    actor_name = serializers.CharField(source="actor.name", read_only=True)

    class Meta:
        model = AuditLog
        fields = ["id", "action", "details", "actor_email", "actor_name", "created_at"]


class AWSAccountSerializer(serializers.ModelSerializer):
    secret_access_key = serializers.CharField(write_only=True, required=False)
    access_key_id = serializers.CharField(required=False)

    class Meta:
        model = AWSAccount
        fields = [
            "id",
            "organisation",
            "name",
            "access_key_id",
            "secret_access_key",
            "endpoint_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "organisation", "created_at", "updated_at"]

    def validate(self, attrs):
        if not self.instance:
            if not attrs.get("access_key_id"):
                raise serializers.ValidationError({"access_key_id": "This field is required."})
            if not attrs.get("secret_access_key"):
                raise serializers.ValidationError({"secret_access_key": "This field is required."})
        return attrs

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        try:
            decrypted_ak = decrypt_val(instance.access_key_id)
            if len(decrypted_ak) > 4:
                ret["access_key_id"] = decrypted_ak[:4] + "*" * (len(decrypted_ak) - 4)
            else:
                ret["access_key_id"] = "****"
        except Exception:
            ret["access_key_id"] = "****"
        return ret

    def create(self, validated_data):
        validated_data["access_key_id"] = encrypt_val(validated_data["access_key_id"])
        validated_data["secret_access_key"] = encrypt_val(validated_data["secret_access_key"])
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if "access_key_id" in validated_data:
            validated_data["access_key_id"] = encrypt_val(validated_data["access_key_id"])
        if "secret_access_key" in validated_data:
            validated_data["secret_access_key"] = encrypt_val(validated_data["secret_access_key"])
        return super().update(instance, validated_data)
