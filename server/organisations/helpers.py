from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import NotFound, PermissionDenied

from .constants import OrganisationMemberRole
from .models import AuditLog, Organisation, OrganisationMember


def is_org_manager(organisation, user):
    """Whether the user may manage the organisation (its owner or an admin)."""
    if organisation.owner_id == user.id:
        return True
    return organisation.members.filter(
        user=user, role=OrganisationMemberRole.ADMIN.value
    ).exists()


def is_non_guest_member(organisation, user):
    """Whether the user is a non-guest member (owner, admin, or regular).

    These roles may mutate organisation resources and may view organisation
    data hidden from guests (members directory, audit logs, AWS accounts).
    """
    if organisation.owner_id == user.id:
        return True
    return organisation.members.filter(
        user=user,
        role__in=[
            OrganisationMemberRole.ADMIN.value,
            OrganisationMemberRole.REGULAR.value,
        ],
    ).exists()


def create_default_organisation(user):
    """Create the personal default organisation owned by the user."""
    first_name = user.name.split(" ")[0] if user.name else "Personal"
    return Organisation.objects.create(name=f"{first_name}'s Organisation", owner=user)


def get_active_organisation(request, raise_exception=True):
    org_id = request.headers.get("X-Active-Org-Id")

    if org_id and org_id not in ["null", "undefined"]:
        try:
            organisation = Organisation.objects.get(id=org_id)
        except (Organisation.DoesNotExist, ValueError, DjangoValidationError):
            if raise_exception:
                raise NotFound("Requested organisation not found.")
            return None

        # Verify membership or ownership.
        if (
            organisation.owner == request.user
            or organisation.members.filter(user=request.user).exists()
        ):
            return organisation
        if raise_exception:
            raise PermissionDenied("You do not have access to this organisation.")
        return None

    # Fallback: find any organisation where the user is owner or member.
    org = Organisation.objects.filter(owner=request.user).first()
    if not org:
        member = OrganisationMember.objects.filter(user=request.user).first()
        if member:
            org = member.organisation
        else:
            org = create_default_organisation(request.user)
    return org


def log_action(organisation, actor, action, details=None):
    """Log an audit action."""
    if details is None:
        details = {}
    return AuditLog.objects.create(
        organisation=organisation, actor=actor, action=action, details=details
    )
