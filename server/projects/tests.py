from accounts.models import User
from django.urls import reverse
from organisations.models import Organisation
from orqestra.tests import BaseTestCase
from rest_framework import status

from .models import Project


class ProjectViewSetTests(BaseTestCase):
    """Covers queryset scoping, ownership, and validation for projects."""

    def setUp(self):
        super().setUp()
        self.project = Project.objects.create(
            organisation=self.organisation, name="My Project"
        )

        self.other_user = User.objects.create_user(
            email="other@example.com",
            password="TestPassword123!",
            name="Other User",
        )
        self.other_org = Organisation.objects.create(
            name="Other Org", owner=self.other_user
        )
        self.other_project = Project.objects.create(
            organisation=self.other_org, name="Other Project"
        )

    def test_list_returns_only_active_organisation_projects(self):
        response = self.client.get(reverse("project-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = {entry["id"] for entry in response.data}
        self.assertEqual(returned_ids, {str(self.project.id)})

    def test_create_assigns_active_organisation(self):
        response = self.client.post(
            reverse("project-list"), {"name": "Fresh Project"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = Project.objects.get(name="Fresh Project")
        self.assertEqual(created.organisation, self.organisation)

    def test_create_without_name_is_invalid(self):
        response = self.client.post(reverse("project-list"), {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_retrieve_cross_organisation_project_returns_404(self):
        response = self.client.get(
            reverse("project-detail", args=[self.other_project.id])
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_uses_lightweight_serializer(self):
        self.project.nodes = [{"id": "a"}, {"id": "b"}]
        self.project.edges = [{"id": "e1"}]
        self.project.save(update_fields=["nodes", "edges"])

        response = self.client.get(reverse("project-list"))
        entry = next(
            item for item in response.data if item["id"] == str(self.project.id)
        )
        self.assertEqual(entry["node_count"], 2)
        self.assertNotIn("nodes", entry)
        self.assertNotIn("edges", entry)

    def test_retrieve_returns_full_graph(self):
        self.project.nodes = [{"id": "a"}]
        self.project.save(update_fields=["nodes"])

        response = self.client.get(reverse("project-detail", args=[self.project.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("nodes", response.data)
        self.assertEqual(len(response.data["nodes"]), 1)
