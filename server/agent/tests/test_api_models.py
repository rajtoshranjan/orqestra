from django.test import TestCase
from organisations.models import Organisation
from projects.models import Project

from accounts.models import User
from agent.models import AgentConversation, AgentRun


class CatalogAndPropertyTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="a@example.com", password="TestPassword123!", name="A"
        )
        self.org = Organisation.objects.create(name="Org", owner=self.user)
        self.project = Project.objects.create(organisation=self.org, name="P")
        self.conversation = AgentConversation.objects.create(
            project=self.project, created_by=self.user
        )

    def test_catalog_defaults_to_empty_list(self):
        self.assertEqual(self.conversation.catalog, [])

    def test_catalog_persists_payload(self):
        self.conversation.catalog = [{"id": "lambda", "name": "AWS Lambda"}]
        self.conversation.save(update_fields=["catalog"])
        self.conversation.refresh_from_db()

        self.assertEqual(self.conversation.catalog[0]["id"], "lambda")

    def test_run_organisation_resolves_through_conversation(self):
        run = AgentRun.objects.create(conversation=self.conversation)

        self.assertEqual(run.organisation, self.org)
