from rest_framework.permissions import IsAuthenticated

from .constants import OrganisationMemberRole
from .helpers import get_active_organisation
from .models import Organisation, OrganisationMember


class IsOrganisationMember(IsAuthenticated):
    """
    Checks if the user is a member of the active organisation.
    """

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        org = get_active_organisation(request, raise_exception=False)
        return org is not None


class CanManageOrganisation(IsAuthenticated):
    """
    Checks if the user is the owner or an admin of the active organisation.
    """

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        org = get_active_organisation(request, raise_exception=False)
        if not org:
            return False
        return (
            org.owner == request.user
            or org.members.filter(
                user=request.user, role=OrganisationMemberRole.ADMIN.value
            ).exists()
        )

    def has_object_permission(self, request, view, obj):
        # If the object is the organisation itself:
        if isinstance(obj, Organisation):
            return (
                obj.owner == request.user
                or obj.members.filter(
                    user=request.user, role=OrganisationMemberRole.ADMIN.value
                ).exists()
            )
        # If the object is an organisation member:
        elif isinstance(obj, OrganisationMember):
            return (
                obj.organisation.owner == request.user
                or obj.organisation.members.filter(
                    user=request.user, role=OrganisationMemberRole.ADMIN.value
                ).exists()
            )
        return False


class CanWriteOrganisation(IsAuthenticated):
    """
    Checks if the user has write/mutate permissions in the active organisation.
    Allows owner, ADMIN, and REGULAR, but blocks GUEST.
    """

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        org = get_active_organisation(request, raise_exception=False)
        if not org:
            return False
        if org.owner == request.user:
            return True
        return org.members.filter(
            user=request.user,
            role__in=[
                OrganisationMemberRole.ADMIN.value,
                OrganisationMemberRole.REGULAR.value,
            ],
        ).exists()

    def has_object_permission(self, request, view, obj):
        org = None
        if isinstance(obj, Organisation):
            org = obj
        elif hasattr(obj, "organisation"):
            org = obj.organisation
        elif hasattr(obj, "project") and hasattr(obj.project, "organisation"):
            org = obj.project.organisation

        if not org:
            return False

        if org.owner == request.user:
            return True

        return org.members.filter(
            user=request.user,
            role__in=[
                OrganisationMemberRole.ADMIN.value,
                OrganisationMemberRole.REGULAR.value,
            ],
        ).exists()
