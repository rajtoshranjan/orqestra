from rest_framework import serializers

from accounts.models import User

from .helpers import get_active_organisation
from .models import Organisation, OrganisationMember


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


from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(source="actor.email", read_only=True)
    actor_name = serializers.CharField(source="actor.name", read_only=True)

    class Meta:
        model = AuditLog
        fields = ["id", "action", "details", "actor_email", "actor_name", "created_at"]
