from django.db.models import Q
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet

from .constants import OrganisationMemberRole
from .helpers import get_active_organisation
from .models import Organisation, OrganisationMember
from .permissions import CanManageOrganisation
from .serializers import OrganisationMemberSerializer, OrganisationSerializer


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

    def perform_destroy(self, instance):
        if instance.owner != self.request.user:
            raise PermissionDenied("Only the owner can delete this organisation.")
        instance.delete()


class OrganisationMemberViewSet(ModelViewSet):
    serializer_class = OrganisationMemberSerializer
    permission_classes = [CanManageOrganisation]

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
        serializer.save()
