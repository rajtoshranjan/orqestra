from django.db.models import Q
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from .constants import OrganisationMemberRole
from .helpers import get_active_organisation, log_action
from .models import Organisation, OrganisationMember
from .permissions import CanManageOrganisation, IsOrganisationMember
from .serializers import (
    AuditLogSerializer,
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


class OrganisationMemberViewSet(ModelViewSet):
    serializer_class = OrganisationMemberSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            self.permission_classes = [IsOrganisationMember]
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
    permission_classes = [IsOrganisationMember]

    def get_queryset(self):
        org = get_active_organisation(self.request)
        return org.audit_logs.all().select_related("actor")
