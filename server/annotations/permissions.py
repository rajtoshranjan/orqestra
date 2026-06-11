from organisations.constants import OrganisationMemberRole
from organisations.helpers import get_active_organisation
from organisations.permissions import IsOrganisationMember


def get_org_role(organisation, user):
    """Return 'owner', a member role value, or None for non-members."""
    if organisation.owner == user:
        return "owner"
    member = organisation.members.filter(user=user).first()
    return member.role if member else None


def can_moderate(role):
    return role in ("owner", OrganisationMemberRole.ADMIN.value)


def can_resolve(role, annotation, user):
    """Regular+ may resolve/reopen/archive any annotation; guests only their own."""
    if role in (
        "owner",
        OrganisationMemberRole.ADMIN.value,
        OrganisationMemberRole.REGULAR.value,
    ):
        return True
    if role == OrganisationMemberRole.GUEST.value:
        return annotation.author == user
    return False


class CanParticipateInAnnotations(IsOrganisationMember):
    """
    Any organisation member (including guests) may view annotations,
    create them, reply, and react. Finer-grained rules (edit own,
    resolve, moderate) are enforced per object in the views.
    """

    def has_object_permission(self, request, view, obj):
        organisation = get_active_organisation(request, raise_exception=False)
        if organisation is None:
            return False
        if hasattr(obj, "project"):
            return obj.project.organisation == organisation
        if hasattr(obj, "annotation"):
            return obj.annotation.project.organisation == organisation
        return False
