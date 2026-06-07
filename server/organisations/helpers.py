from .models import Organisation, OrganisationMember


def get_active_organisation(request, raise_exception=True):
    org_id = request.headers.get("X-Active-Org-Id")
    from django.core.exceptions import ValidationError as DjangoValidationError

    if org_id and org_id not in ["null", "undefined"]:
        try:
            organisation = Organisation.objects.get(id=org_id)
            # Verify membership or ownership.
            if (
                organisation.owner == request.user
                or organisation.members.filter(user=request.user).exists()
            ):
                return organisation
        except (Organisation.DoesNotExist, ValueError, DjangoValidationError):
            pass

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
