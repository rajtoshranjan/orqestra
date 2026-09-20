"""Organisation-owned LLM configuration.

Mirrors the AWSAccount pattern: credentials live on the organisation, are
encrypted at rest, masked on read, and only owners/admins may manage them.
"""

from unittest import mock

from accounts.models import User
import anthropic
import httpx
from agent.tests.test_anthropic_provider import _FakeClient
from django.urls import reverse
from organisations.constants import LLMProviderChoice, OrganisationMemberRole
from organisations.models import AuditLog, LLMConfig, Organisation, OrganisationMember
from orqestra.tests import BaseTestCase
from rest_framework import status
from utils.encryption import decrypt_val

LIST_URL = "organisation-llm-config-list"



def payload(**overrides):
    data = {
        "name": "Claude Sonnet 5",
        "provider": LLMProviderChoice.ANTHROPIC.value,
        "model": "claude-sonnet-5",
        "api_key": "sk-ant-secret",
    }
    data.update(overrides)
    return data


class LLMConfigModelTests(BaseTestCase):
    def test_only_one_config_can_be_the_default_for_an_organisation(self):
        first = LLMConfig.objects.create(
            organisation=self.organisation,
            name="A",
            provider=LLMProviderChoice.ANTHROPIC.value,
            model="claude-sonnet-5",
            is_default=True,
        )
        second = LLMConfig.objects.create(
            organisation=self.organisation,
            name="B",
            provider=LLMProviderChoice.GEMINI.value,
            model="gemini-2.5-flash",
            is_default=True,
        )

        first.refresh_from_db()
        self.assertFalse(first.is_default)
        self.assertTrue(second.is_default)

    def test_the_first_config_for_an_organisation_becomes_the_default(self):
        """Otherwise the agent stays unusable until someone notices the toggle."""
        config = LLMConfig.objects.create(
            organisation=self.organisation,
            name="Only one",
            provider=LLMProviderChoice.ANTHROPIC.value,
            model="claude-sonnet-5",
        )

        self.assertTrue(config.is_default)

    def test_defaults_are_scoped_per_organisation(self):
        other_user = User.objects.create_user(
            email="other@example.com", password="TestPassword123!", name="Other"
        )
        other_org = Organisation.objects.create(name="Other", owner=other_user)
        mine = LLMConfig.objects.create(
            organisation=self.organisation,
            name="Mine",
            provider=LLMProviderChoice.ANTHROPIC.value,
            model="claude-sonnet-5",
            is_default=True,
        )
        LLMConfig.objects.create(
            organisation=other_org,
            name="Theirs",
            provider=LLMProviderChoice.ANTHROPIC.value,
            model="claude-sonnet-5",
            is_default=True,
        )

        mine.refresh_from_db()
        self.assertTrue(mine.is_default)


class LLMConfigApiTests(BaseTestCase):
    def test_create_encrypts_the_api_key_at_rest(self):
        response = self.client.post(reverse(LIST_URL), payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        config = LLMConfig.objects.get()
        self.assertNotEqual(config.api_key, "sk-ant-secret")
        self.assertEqual(decrypt_val(config.api_key), "sk-ant-secret")

    def test_the_api_key_is_never_returned(self):
        self.client.post(reverse(LIST_URL), payload(), format="json")

        response = self.client.get(reverse(LIST_URL))

        row = response.data[0]
        self.assertNotIn("sk-ant-secret", str(row))
        self.assertTrue(row["has_api_key"])

    def test_create_writes_an_audit_entry(self):
        self.client.post(reverse(LIST_URL), payload(), format="json")

        self.assertTrue(
            AuditLog.objects.filter(action="llm_config.create").exists(),
        )

    def test_anthropic_requires_an_api_key(self):
        response = self.client.post(
            reverse(LIST_URL), payload(api_key=""), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_local_ollama_needs_a_base_url_but_no_key(self):
        response = self.client.post(
            reverse(LIST_URL),
            payload(
                name="Local qwen",
                provider=LLMProviderChoice.OLLAMA.value,
                model="qwen3:8b",
                api_key="",
                base_url="http://host.docker.internal:11434",
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_ollama_requires_a_base_url(self):
        response = self.client.post(
            reverse(LIST_URL),
            payload(
                name="Broken ollama",
                provider=LLMProviderChoice.OLLAMA.value,
                model="qwen3:8b",
                api_key="",
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_update_without_an_api_key_keeps_the_stored_one(self):
        """Editing the model shouldn't silently wipe the credential."""
        self.client.post(reverse(LIST_URL), payload(), format="json")
        config = LLMConfig.objects.get()

        response = self.client.patch(
            reverse("organisation-llm-config-detail", args=[str(config.id)]),
            {"model": "claude-opus-5"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        config.refresh_from_db()
        self.assertEqual(config.model, "claude-opus-5")
        self.assertEqual(decrypt_val(config.api_key), "sk-ant-secret")

    def test_list_is_scoped_to_the_active_organisation(self):
        other_user = User.objects.create_user(
            email="other@example.com", password="TestPassword123!", name="Other"
        )
        other_org = Organisation.objects.create(name="Other", owner=other_user)
        LLMConfig.objects.create(
            organisation=other_org,
            name="Theirs",
            provider=LLMProviderChoice.ANTHROPIC.value,
            model="claude-sonnet-5",
        )
        self.client.post(reverse(LIST_URL), payload(), format="json")

        response = self.client.get(reverse(LIST_URL))

        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["name"], "Claude Sonnet 5")


class LLMConfigPermissionTests(BaseTestCase):
    def _as(self, role):
        member = User.objects.create_user(
            email=f"{role}@example.com", password="TestPassword123!", name=role
        )
        OrganisationMember.objects.create(
            organisation=self.organisation, user=member, role=role
        )
        self.client.force_authenticate(user=member)
        self.client.credentials(HTTP_X_ACTIVE_ORG_ID=str(self.organisation.id))

    def test_a_regular_member_may_read_but_not_create(self):
        self._as(OrganisationMemberRole.REGULAR.value)

        self.assertEqual(
            self.client.get(reverse(LIST_URL)).status_code, status.HTTP_200_OK
        )
        self.assertEqual(
            self.client.post(reverse(LIST_URL), payload(), format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_a_guest_may_not_even_read(self):
        self._as(OrganisationMemberRole.GUEST.value)

        self.assertEqual(
            self.client.get(reverse(LIST_URL)).status_code, status.HTTP_403_FORBIDDEN
        )


class OrganisationScopedObjectPermissionTests(BaseTestCase):
    """`CanManageOrganisation` must recognise the objects it guards.

    It previously matched only Organisation and OrganisationMember, so every
    detail route on an organisation-scoped model — AWS accounts included —
    returned 403 to the org owner and the audit entry in `perform_update`
    could never run.
    """

    def test_owner_can_edit_an_aws_account(self):
        created = self.client.post(
            reverse("organisation-aws-account-list"),
            {"name": "Prod", "access_key_id": "AKIA1", "secret_access_key": "s"},
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)

        response = self.client.patch(
            reverse("organisation-aws-account-detail", args=[created.data["id"]]),
            {"name": "Prod renamed"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_owner_can_delete_an_llm_config(self):
        created = self.client.post(reverse(LIST_URL), payload(), format="json")

        response = self.client.delete(
            reverse("organisation-llm-config-detail", args=[created.data["id"]])
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_a_manager_of_another_organisation_is_refused(self):
        outsider = User.objects.create_user(
            email="outsider@example.com", password="TestPassword123!", name="Outsider"
        )
        other_org = Organisation.objects.create(name="Other", owner=outsider)
        foreign = LLMConfig.objects.create(
            organisation=other_org,
            name="Theirs",
            provider=LLMProviderChoice.ANTHROPIC.value,
            model="claude-sonnet-5",
        )

        response = self.client.patch(
            reverse("organisation-llm-config-detail", args=[str(foreign.id)]),
            {"name": "hijacked"},
            format="json",
        )

        self.assertIn(
            response.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND),
        )


class LLMConfigConnectionTestTests(BaseTestCase):
    """Checking a credential before saving, so a bad key isn't found mid-run."""

    URL = "organisation-llm-config-test"

    def test_a_reachable_provider_reports_success(self):
        with mock.patch("anthropic.Anthropic", return_value=_FakeClient()):
            response = self.client.post(reverse(self.URL), payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["ok"])

    def test_a_provider_failure_is_reported_without_a_500(self):
        failure = anthropic.AuthenticationError(
            "sk-ant-secret", body={"error": "sk-ant-secret"},
            response=httpx.Response(401, request=httpx.Request("POST", "https://api.anthropic.com")),
        )
        with mock.patch("anthropic.Anthropic", side_effect=failure):
            response = self.client.post(reverse(self.URL), payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["ok"])
        self.assertIn("401", response.data["error"])
        self.assertNotIn("sk-ant-secret", str(response.data))

    def test_testing_a_saved_config_reuses_its_stored_key(self):
        """The form never receives the key back, so it can't resend it."""
        created = self.client.post(reverse(LIST_URL), payload(), format="json")

        with mock.patch("anthropic.Anthropic", return_value=_FakeClient()) as client_factory:
            response = self.client.post(
                reverse(self.URL),
                {
                    "config": created.data["id"],
                    "provider": LLMProviderChoice.ANTHROPIC.value,
                    "model": "claude-sonnet-5",
                },
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(client_factory.call_args.kwargs["api_key"], "sk-ant-secret")

    def test_a_regular_member_may_not_dial_out(self):
        member = User.objects.create_user(
            email="regular@example.com", password="TestPassword123!", name="R"
        )
        OrganisationMember.objects.create(
            organisation=self.organisation,
            user=member,
            role=OrganisationMemberRole.REGULAR.value,
        )
        self.client.force_authenticate(user=member)
        self.client.credentials(HTTP_X_ACTIVE_ORG_ID=str(self.organisation.id))

        response = self.client.post(reverse(self.URL), payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_a_saved_config_from_another_organisation_is_refused(self):
        outsider = User.objects.create_user(
            email="outsider@example.com", password="TestPassword123!", name="O"
        )
        other_org = Organisation.objects.create(name="Other", owner=outsider)
        foreign = LLMConfig.objects.create(
            organisation=other_org,
            name="Theirs",
            provider=LLMProviderChoice.ANTHROPIC.value,
            model="claude-sonnet-5",
        )

        response = self.client.post(
            reverse(self.URL),
            {
                "config": str(foreign.id),
                "provider": LLMProviderChoice.ANTHROPIC.value,
                "model": "claude-sonnet-5",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
