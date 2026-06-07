from django.urls import reverse
from rest_framework import status

from accounts.models import User
from organisations.constants import OrganisationMemberRole
from organisations.models import Organisation, OrganisationMember
from orqestra.tests import BaseTestCase


class OrganisationsTests(BaseTestCase):
    """Tests for organisation scoping and membership management."""

    def test_create_organisation(self):
        url = reverse("organisation-list")
        payload = {"name": "Another Org"}
        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "Another Org")
        self.assertEqual(response.data["role"], "owner")

    def test_list_organisations(self):
        # Create an organization where user is owner.
        Organisation.objects.create(name="Owned Org", owner=self.user)

        # Create another user and org.
        other_user = User.objects.create_user(
            email="other@example.com",
            password="OtherPassword123!",
            name="Other User",
        )
        other_org = Organisation.objects.create(name="Other Org", owner=other_user)

        # Add user as member to other org.
        OrganisationMember.objects.create(
            organisation=other_org,
            user=self.user,
            role=OrganisationMemberRole.REGULAR.value,
        )

        url = reverse("organisation-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should contain the initial org created in setUp, the newly owned org, and the other membership org.
        self.assertEqual(len(response.data), 3)
