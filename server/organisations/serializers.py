from accounts.models import User
from rest_framework import serializers
from utils.encryption import decrypt_val, encrypt_val

from .constants import (
    LLM_PROVIDERS_REQUIRING_BASE_URL,
    LLM_PROVIDERS_REQUIRING_KEY,
    LLMProviderChoice,
)
from .helpers import get_active_organisation
from .models import AuditLog, AWSAccount, LLMConfig, Organisation, OrganisationMember


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

        # ``current_user_memberships`` is prefetched for the current user on the
        # list endpoint; fall back to a query for single-object serialization.
        memberships = getattr(organisation, "current_user_memberships", None)
        if memberships is not None:
            member = memberships[0] if memberships else None
        else:
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
                raise serializers.ValidationError(
                    {"access_key_id": "This field is required."}
                )
            if not attrs.get("secret_access_key"):
                raise serializers.ValidationError(
                    {"secret_access_key": "This field is required."}
                )
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
        validated_data["secret_access_key"] = encrypt_val(
            validated_data["secret_access_key"]
        )
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if "access_key_id" in validated_data:
            validated_data["access_key_id"] = encrypt_val(
                validated_data["access_key_id"]
            )
        if "secret_access_key" in validated_data:
            validated_data["secret_access_key"] = encrypt_val(
                validated_data["secret_access_key"]
            )
        return super().update(instance, validated_data)


class LLMConfigSerializer(serializers.ModelSerializer):
    """Encrypts the key on write and never returns it on read.

    Unlike an AWS access key id, there is nothing useful to show from a model
    API key — a masked prefix would only invite people to compare it — so the
    read side reports whether one is stored and nothing more.
    """

    api_key = serializers.CharField(
        write_only=True, required=False, allow_blank=True, trim_whitespace=True
    )
    has_api_key = serializers.SerializerMethodField()

    class Meta:
        model = LLMConfig
        fields = [
            "id",
            "organisation",
            "name",
            "provider",
            "model",
            "api_key",
            "has_api_key",
            "base_url",
            "context_window",
            "is_default",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "organisation", "created_at", "updated_at"]

    def get_has_api_key(self, config) -> bool:
        return bool(config.api_key)

    def validate(self, attrs):
        provider = attrs.get("provider") or getattr(self.instance, "provider", None)

        # On update an absent key means "leave the stored one alone", so only
        # demand one when there is nothing on file.
        stored_key = getattr(self.instance, "api_key", "")
        key = attrs.get("api_key", stored_key)
        if provider in LLM_PROVIDERS_REQUIRING_KEY and not key:
            raise serializers.ValidationError(
                {"api_key": f"An API key is required for {provider}."}
            )

        base_url = attrs.get("base_url", getattr(self.instance, "base_url", ""))
        if provider in LLM_PROVIDERS_REQUIRING_BASE_URL and not base_url:
            raise serializers.ValidationError(
                {
                    "base_url": (
                        f"A base URL is required for {provider} — for example "
                        "http://host.docker.internal:11434 for a local endpoint."
                    )
                }
            )
        return attrs

    def create(self, validated_data):
        validated_data["api_key"] = encrypt_val(validated_data.get("api_key", ""))
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # A blank or absent key keeps the stored credential rather than wiping
        # it, so editing the model id doesn't cost you the key.
        if validated_data.get("api_key"):
            validated_data["api_key"] = encrypt_val(validated_data["api_key"])
        else:
            validated_data.pop("api_key", None)
        return super().update(instance, validated_data)


class LLMConfigTestSerializer(serializers.Serializer):
    """An unsaved config to dial, so the form can be checked before saving."""

    provider = serializers.ChoiceField(choices=LLMProviderChoice.choices())
    model = serializers.CharField(max_length=255)
    api_key = serializers.CharField(required=False, allow_blank=True, default="")
    base_url = serializers.CharField(required=False, allow_blank=True, default="")
    context_window = serializers.IntegerField(required=False, default=0, min_value=0)
    # Set when re-testing a saved config whose key the form never received.
    config = serializers.PrimaryKeyRelatedField(
        queryset=LLMConfig.objects.none(), required=False
    )

    def __init__(self, *args, configs=None, **kwargs):
        super().__init__(*args, **kwargs)
        if configs is not None:
            self.fields["config"].queryset = configs
