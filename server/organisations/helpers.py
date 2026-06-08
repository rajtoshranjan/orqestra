from .models import Organisation, OrganisationMember


def get_active_organisation(request, raise_exception=True):
    org_id = request.headers.get("X-Active-Org-Id")
    from django.core.exceptions import ValidationError as DjangoValidationError
    from rest_framework.exceptions import NotFound, PermissionDenied

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
        else:
            if raise_exception:
                raise PermissionDenied("You do not have access to this organisation.")
            return None

    # Fallback: Find any organization where user is owner or member.
    org = Organisation.objects.filter(owner=request.user).first()
    if not org:
        member = OrganisationMember.objects.filter(user=request.user).first()
        if member:
            org = member.organisation
        else:
            # Create a default organisation on the fly.
            name = request.user.name.split(" ")[0] if request.user.name else "Personal"
            org = Organisation.objects.create(
                name=f"{name}'s Organisation", owner=request.user
            )
    return org


def log_action(organisation, actor, action, details=None):
    """
    Log an audit action.
    """
    from .models import AuditLog

    if details is None:
        details = {}
    return AuditLog.objects.create(
        organisation=organisation, actor=actor, action=action, details=details
    )
