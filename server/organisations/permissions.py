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
