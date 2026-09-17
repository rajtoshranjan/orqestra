from agent.llm.registry import provider_from_credentials
from agent.llm.types import LLMMessage, Role, TextBlock
from django.db.models import Prefetch, Q
from orqestra.pagination import StandardResultsSetPagination
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet
from utils.encryption import decrypt_val

from .constants import OrganisationMemberRole
from .helpers import create_default_organisation, get_active_organisation, log_action
from .models import AuditLog, AWSAccount, LLMConfig, Organisation, OrganisationMember
from .permissions import CanManageOrganisation, IsNonGuestMember, IsOrganisationMember
from .serializers import (
    AuditLogSerializer,
    AWSAccountSerializer,
    LLMConfigSerializer,
    LLMConfigTestSerializer,
    OrganisationMemberSerializer,
    OrganisationSerializer,
)


class OrganisationViewSet(ModelViewSet):
    serializer_class = OrganisationSerializer
    permission_classes = [CanManageOrganisation]

    def get_permissions(self):
        if self.action in ["create", "list"]:
            self.permission_classes = [IsAuthenticated]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        queryset = (
            Organisation.objects.filter(Q(members__user=user) | Q(owner=user))
            .distinct()
            .select_related("owner")
            .prefetch_related(
                Prefetch(
                    "members",
                    queryset=OrganisationMember.objects.filter(user=user),
                    to_attr="current_user_memberships",
                )
            )
        )

        if not queryset.exists():
            create_default_organisation(user)

        return queryset

    def perform_create(self, serializer):
        org = serializer.save()
        log_action(
            organisation=org,
            actor=self.request.user,
            action="organisation.create",
            details={"name": org.name},
        )

    def perform_update(self, serializer):
        org = serializer.save()
        log_action(
            organisation=org,
            actor=self.request.user,
            action="organisation.update",
            details={"name": org.name},
        )

    def perform_destroy(self, instance):
        if instance.owner != self.request.user:
            raise PermissionDenied("Only the owner can delete this organisation.")
        instance.delete()

    @action(
        detail=False,
        methods=["get"],
        url_path="mentionable-users",
        permission_classes=[IsOrganisationMember],
    )
    def mentionable_users(self, request):
        """Users who can be @mentioned in the active organisation: owner + members."""
        org = get_active_organisation(request)
        users = [
            {
                "id": str(org.owner_id),
                "name": org.owner.name,
                "email": org.owner.email,
                "role": "owner",
            }
        ]
        members = org.members.select_related("user").exclude(user=org.owner)
        users.extend(
            {
                "id": str(member.user_id),
                "name": member.user.name,
                "email": member.user.email,
                "role": member.role,
            }
            for member in members
        )
        return Response(users)


class OrganisationMemberViewSet(ModelViewSet):
    serializer_class = OrganisationMemberSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            # The member directory is hidden from guests.
            self.permission_classes = [IsNonGuestMember]
        else:
            self.permission_classes = [CanManageOrganisation]
        return super().get_permissions()

    def get_queryset(self):
        org = get_active_organisation(self.request, raise_exception=False)
        if org:
            return OrganisationMember.objects.filter(organisation_id=org.id)
        return OrganisationMember.objects.none()

    def perform_create(self, serializer):
        org = get_active_organisation(self.request)
        if (
            org.owner != self.request.user
            and not org.members.filter(
                user=self.request.user, role=OrganisationMemberRole.ADMIN.value
            ).exists()
        ):
            raise PermissionDenied(
                "You must be an organisation admin or owner to add members."
            )
        member = serializer.save()
        log_action(
            organisation=org,
            actor=self.request.user,
            action="member.add",
            details={"email": member.user.email, "role": member.role},
        )

    def perform_update(self, serializer):
        member = serializer.save()
        log_action(
            organisation=member.organisation,
            actor=self.request.user,
            action="member.role_update",
            details={"email": member.user.email, "role": member.role},
        )

    def perform_destroy(self, instance):
        organisation = instance.organisation
        user_email = instance.user.email
        instance.delete()
        log_action(
            organisation=organisation,
            actor=self.request.user,
            action="member.remove",
            details={"email": user_email},
        )


class AuditLogViewSet(ReadOnlyModelViewSet):
    serializer_class = AuditLogSerializer
    # Audit logs are hidden from guests.
    permission_classes = [IsNonGuestMember]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        org = get_active_organisation(self.request)
        return (
            AuditLog.objects.for_organisation(org)
            .search(self.request.query_params.get("search"))
            .select_related("actor")
        )


class AWSAccountViewSet(ModelViewSet):
    serializer_class = AWSAccountSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            # AWS accounts are hidden from guests entirely.
            self.permission_classes = [IsNonGuestMember]
        else:
            # AWS-account management is restricted to owners/admins because it
            # exposes cloud credentials; regular members may not mutate it.
            self.permission_classes = [CanManageOrganisation]
        return super().get_permissions()

    def get_queryset(self):
        org = get_active_organisation(self.request, raise_exception=False)
        if org:
            return AWSAccount.objects.filter(organisation_id=org.id)
        return AWSAccount.objects.none()

    def perform_create(self, serializer):
        active_org = get_active_organisation(self.request)
        aws_account = serializer.save(organisation=active_org)
        log_action(
            organisation=active_org,
            actor=self.request.user,
            action="aws_account.create",
            details={
                "aws_account_id": str(aws_account.id),
                "aws_account_name": aws_account.name,
            },
        )

    def perform_update(self, serializer):
        aws_account = serializer.save()
        log_action(
            organisation=aws_account.organisation,
            actor=self.request.user,
            action="aws_account.update",
            details={
                "aws_account_id": str(aws_account.id),
                "aws_account_name": aws_account.name,
            },
        )

    def perform_destroy(self, instance):
        org = instance.organisation
        aws_account_id = str(instance.id)
        aws_account_name = instance.name
        instance.delete()
        log_action(
            organisation=org,
            actor=self.request.user,
            action="aws_account.delete",
            details={
                "aws_account_id": aws_account_id,
                "aws_account_name": aws_account_name,
            },
        )


class LLMConfigViewSet(ModelViewSet):
    """Organisation-owned model credentials, managed like AWS accounts."""

    serializer_class = LLMConfigSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            # Hidden from guests entirely, like AWS accounts.
            self.permission_classes = [IsNonGuestMember]
        else:
            # Management is restricted to owners/admins: these are credentials.
            self.permission_classes = [CanManageOrganisation]
        return super().get_permissions()

    def get_queryset(self):
        org = get_active_organisation(self.request, raise_exception=False)
        if org:
            return LLMConfig.objects.filter(organisation_id=org.id)
        return LLMConfig.objects.none()

    def perform_create(self, serializer):
        active_org = get_active_organisation(self.request)
        config = serializer.save(organisation=active_org)
        log_action(
            organisation=active_org,
            actor=self.request.user,
            action="llm_config.create",
            details={
                "llm_config_id": str(config.id),
                "llm_config_name": config.name,
                "provider": config.provider,
                "model": config.model,
            },
        )

    def perform_update(self, serializer):
        config = serializer.save()
        log_action(
            organisation=config.organisation,
            actor=self.request.user,
            action="llm_config.update",
            details={
                "llm_config_id": str(config.id),
                "llm_config_name": config.name,
                "provider": config.provider,
                "model": config.model,
            },
        )

    @action(detail=False, methods=["post"])
    def test(self, request):
        """Dial the provider once so a bad key or model id surfaces at setup.

        Reports the failure in the response body rather than as an error
        status: a refused credential is a valid answer to "does this work?",
        not a broken request.
        """
        payload = LLMConfigTestSerializer(
            data=request.data, configs=self.get_queryset()
        )
        payload.is_valid(raise_exception=True)
        data = payload.validated_data

        # The form never receives a stored key back, so re-testing a saved
        # config has to fall back to the one on file.
        saved = data.get("config")
        api_key = data.get("api_key") or (
            decrypt_val(saved.api_key) if saved and saved.api_key else ""
        )

        try:
            provider = provider_from_credentials(
                provider=data["provider"],
                model=data["model"],
                api_key=api_key,
                base_url=data.get("base_url", ""),
                context_window=data.get("context_window", 0),
            )
            for _ in provider.stream(
                system_prompt="Reply with the single word: ok.",
                messages=[LLMMessage(role=Role.USER, content=[TextBlock(text="ping")])],
                tools=[],
                max_tokens=16,
            ):
                pass
        except Exception as error:  # noqa: BLE001 - the failure IS the answer
            return Response({"ok": False, "error": str(error)})

        return Response({"ok": True, "model": data["model"]})

    def perform_destroy(self, instance):
        organisation = instance.organisation
        details = {
            "llm_config_id": str(instance.id),
            "llm_config_name": instance.name,
        }
        was_default = instance.is_default
        instance.delete()
        # Never leave an organisation with configs but no default, or the agent
        # silently stops working for every project that didn't name one.
        if was_default:
            replacement = organisation.llm_configs.order_by("created_at").first()
            if replacement:
                replacement.is_default = True
                replacement.save(update_fields=["is_default", "updated_at"])
        log_action(
            organisation=organisation,
            actor=self.request.user,
            action="llm_config.delete",
            details=details,
        )
