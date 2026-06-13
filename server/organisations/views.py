from django.db.models import Q
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from .constants import OrganisationMemberRole
from .helpers import get_active_organisation, log_action
from .models import AWSAccount, Organisation, OrganisationMember
from .permissions import (
    CanManageOrganisation,
    IsNonGuestMember,
    IsOrganisationMember,
)
from .serializers import (
    AuditLogSerializer,
    AWSAccountSerializer,
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
        qs = Organisation.objects.filter(
            Q(members__user=self.request.user) | Q(owner=self.request.user)
        ).distinct()

        if not qs.exists():
            name = (
                self.request.user.name.split(" ")[0]
                if self.request.user.name
                else "Personal"
            )
            default_org = Organisation.objects.create(
                name=f"{name}'s Organisation", owner=self.request.user
            )
            qs = Organisation.objects.filter(id=default_org.id)

        return qs

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

    def get_queryset(self):
        org = get_active_organisation(self.request)
        return org.audit_logs.all().select_related("actor")


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
