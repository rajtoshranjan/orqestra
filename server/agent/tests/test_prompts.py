from accounts.models import User
from agent.prompts import build_system_prompt
from django.test import TestCase
from organisations.models import Organisation
from projects.models import Project


class PromptTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="a@example.com", password="TestPassword123!", name="A"
        )
        self.org = Organisation.objects.create(name="Org", owner=self.user)
        self.project = Project.objects.create(
            organisation=self.org,
            name="P",
            nodes=[{"id": "n1", "data": {"service_id": "lambda", "label": "API"}}],
            edges=[],
        )
        self.catalog = [
            {"id": "lambda", "name": "AWS Lambda", "category": "compute"},
            {"id": "s3", "name": "Amazon S3", "category": "storage"},
        ]

    def test_prompt_lists_catalog_services(self):
        prompt = build_system_prompt(self.catalog, self.project)

        self.assertIn("AWS Lambda", prompt)
        self.assertIn("s3", prompt)

    def test_prompt_summarizes_current_graph(self):
        prompt = build_system_prompt(self.catalog, self.project)

        self.assertIn("n1", prompt)
        self.assertIn("1 node", prompt)

    def test_prompt_mentions_target_user_and_rules(self):
        prompt = build_system_prompt(self.catalog, self.project)

        self.assertIn("DevOps", prompt)
        self.assertIn("validate", prompt)
