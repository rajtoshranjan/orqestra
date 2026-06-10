from django.conf import settings
from django.db import models
from orqestra.models import BaseModel

from .constants import OrganisationMemberRole


class Organisation(BaseModel):
    name = models.CharField(max_length=100)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="owned_organisations",
    )

    class Meta(BaseModel.Meta):
        db_table = "organisations"

    def __str__(self):
        return self.name


class OrganisationMember(BaseModel):
    organisation = models.ForeignKey(
        Organisation, on_delete=models.CASCADE, related_name="members"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="organisation_memberships",
    )
    role = models.CharField(
        max_length=10,
        choices=OrganisationMemberRole.choices(),
        default=OrganisationMemberRole.REGULAR.value,
    )

    class Meta(BaseModel.Meta):
        db_table = "organisation_members"
        unique_together = ("organisation", "user")

    def __str__(self):
        return f"{self.user.email} - {self.organisation.name} ({self.role})"


class AuditLog(BaseModel):
    organisation = models.ForeignKey(
        Organisation,
        on_delete=models.CASCADE,
        related_name="audit_logs",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="audit_actions",
    )
    action = models.CharField(max_length=100)
    details = models.JSONField(default=dict, blank=True)

    class Meta(BaseModel.Meta):
        db_table = "audit_logs"
        ordering = ["-created_at"]

    def __str__(self):
        actor_email = self.actor.email if self.actor else "system"
        return f"{self.action} by {actor_email} in {self.organisation.name}"


class AWSAccount(BaseModel):
    organisation = models.ForeignKey(
        Organisation,
        on_delete=models.CASCADE,
        related_name="aws_accounts",
    )
    name = models.CharField(max_length=255)
    access_key_id = models.CharField(max_length=255)
    secret_access_key = models.CharField(max_length=255)
    endpoint_url = models.CharField(max_length=512, blank=True, default="")

    class Meta(BaseModel.Meta):
        db_table = "aws_accounts"
        unique_together = ("organisation", "name")

    def __str__(self):
        return f"{self.name} ({self.organisation.name})"
