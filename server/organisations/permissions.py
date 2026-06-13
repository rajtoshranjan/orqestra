from rest_framework.permissions import IsAuthenticated

from .helpers import get_active_organisation, is_non_guest_member, is_org_manager
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


class IsNonGuestMember(IsAuthenticated):
    """
    Allows non-guest members (owner / admin / regular) of the active
    organisation. Used for organisation data guests must not see at all
    (members directory, audit logs, AWS accounts).
    """

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        org = get_active_organisation(request, raise_exception=False)
        if not org:
            return False
        return is_non_guest_member(org, request.user)


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
        return is_org_manager(org, request.user)

    def has_object_permission(self, request, view, obj):
        if isinstance(obj, Organisation):
            organisation = obj
        elif isinstance(obj, OrganisationMember):
            organisation = obj.organisation
        else:
            return False
        return is_org_manager(organisation, request.user)


class CanWriteOrganisation(IsAuthenticated):
    """
    Checks if the user has write/mutate permissions in the active organisation.
    Allows owner, admin, and regular members, but blocks guests.
    """

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        org = get_active_organisation(request, raise_exception=False)
        if not org:
            return False
        return is_non_guest_member(org, request.user)

    def has_object_permission(self, request, view, obj):
        organisation = None
        if isinstance(obj, Organisation):
            organisation = obj
        elif hasattr(obj, "organisation"):
            organisation = obj.organisation
        elif hasattr(obj, "project") and hasattr(obj.project, "organisation"):
            organisation = obj.project.organisation

        if not organisation:
            return False

        return is_non_guest_member(organisation, request.user)
