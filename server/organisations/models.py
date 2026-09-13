from django.conf import settings
from django.db import models
from django.db.models import Q
from orqestra.models import BaseModel

from .constants import LLMProviderChoice, OrganisationMemberRole


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


class AuditLogQuerySet(models.QuerySet):
    def for_organisation(self, organisation):
        return self.filter(organisation=organisation)

    def search(self, query):
        query = (query or "").strip()
        if not query:
            return self
        return self.filter(
            Q(action__icontains=query)
            | Q(actor__email__icontains=query)
            | Q(actor__name__icontains=query)
        )


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

    objects = AuditLogQuerySet.as_manager()

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


class LLMConfig(BaseModel):
    """An organisation's connection to a model provider.

    The agent's counterpart to AWSAccount: credentials belong to the
    organisation, are encrypted at rest by the serializer, and are decrypted
    only at the point the provider is built.
    """

    organisation = models.ForeignKey(
        Organisation,
        on_delete=models.CASCADE,
        related_name="llm_configs",
    )
    name = models.CharField(max_length=255)
    provider = models.CharField(max_length=32, choices=LLMProviderChoice.choices())
    model = models.CharField(max_length=255)
    # Encrypted. Blank for a local Ollama endpoint, which needs no key.
    api_key = models.CharField(max_length=512, blank=True, default="")
    # Operator-supplied endpoint, for providers that have one (Ollama).
    base_url = models.CharField(max_length=512, blank=True, default="")
    # Context window to request from a local endpoint. 0 = provider default.
    context_window = models.PositiveIntegerField(default=0)
    # The config the agent uses when a project names none. Exactly one per org.
    is_default = models.BooleanField(default=False)

    class Meta(BaseModel.Meta):
        db_table = "llm_configs"
        unique_together = ("organisation", "name")

    def __str__(self):
        return f"{self.name} ({self.provider})"

    def save(self, *args, **kwargs):
        # The first config an organisation adds becomes its default, so the
        # agent works straight after setup rather than waiting on a toggle.
        siblings = LLMConfig.objects.filter(organisation_id=self.organisation_id)
        if self.pk:
            siblings = siblings.exclude(pk=self.pk)
        if not siblings.exists():
            self.is_default = True

        super().save(*args, **kwargs)

        # Exactly one default per organisation.
        if self.is_default:
            siblings.filter(is_default=True).update(is_default=False)
