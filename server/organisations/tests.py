from accounts.models import User
from django.urls import reverse
from organisations.constants import OrganisationMemberRole
from organisations.models import Organisation, OrganisationMember
from orqestra.tests import BaseTestCase
from rest_framework import status


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
        # Create an organisation where user is owner.
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


class MentionableUsersTests(BaseTestCase):
    def test_returns_owner_and_members(self):
        member_user = User.objects.create_user(
            email="member@example.com",
            password="MemberPassword123!",
            name="Member User",
        )
        OrganisationMember.objects.create(
            organisation=self.organisation,
            user=member_user,
            role=OrganisationMemberRole.REGULAR.value,
        )

        response = self.client.get("/organisations/mentionable-users/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        users = {entry["id"]: entry for entry in response.json()["data"]}
        self.assertEqual(set(users), {str(self.user.id), str(member_user.id)})
        self.assertEqual(users[str(self.user.id)]["role"], "owner")
        self.assertEqual(users[str(member_user.id)]["role"], "regular")


class OrganisationSecurityTests(BaseTestCase):
    """Tests for role-based access control, scoping, and audit logs."""

    def test_block_global_user_list(self):
        url = reverse("user-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["detail"], "Listing all users is not allowed.")

    def test_regular_member_can_list_members_but_cannot_invite(self):
        # Create a regular member.
        regular_user = User.objects.create_user(
            email="regular@example.com",
            password="RegularPassword123!",
            name="Regular User",
        )
        OrganisationMember.objects.create(
            organisation=self.organisation,
            user=regular_user,
            role=OrganisationMemberRole.REGULAR.value,
        )

        # Authenticate as regular member.
        self.client.force_authenticate(user=regular_user)
        self.client.credentials(HTTP_X_ACTIVE_ORG_ID=str(self.organisation.id))

        # Can list members.
        url = reverse("organisation-member-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

        # Cannot invite member.
        response = self.client.post(
            url,
            {
                "email": "newinvite@example.com",
                "role": OrganisationMemberRole.GUEST.value,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_guest_cannot_write_projects(self):
        # Create a guest member.
        guest_user = User.objects.create_user(
            email="guest@example.com",
            password="GuestPassword123!",
            name="Guest User",
        )
        OrganisationMember.objects.create(
            organisation=self.organisation,
            user=guest_user,
            role=OrganisationMemberRole.GUEST.value,
        )

        # Authenticate as guest.
        self.client.force_authenticate(user=guest_user)
        self.client.credentials(HTTP_X_ACTIVE_ORG_ID=str(self.organisation.id))

        # Guest cannot create project.
        url = reverse("project-list")
        response = self.client.post(url, {"name": "Guest Project"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def _add_member(self, email, role):
        member_user = User.objects.create_user(
            email=email,
            password="MemberPassword123!",
            name=email.split("@")[0],
        )
        OrganisationMember.objects.create(
            organisation=self.organisation,
            user=member_user,
            role=role,
        )
        return member_user

    def test_regular_member_cannot_manage_aws_accounts(self):
        # AWS-account management is locked to owners/admins.
        regular_user = self._add_member(
            "regularaws@example.com", OrganisationMemberRole.REGULAR.value
        )
        self.client.force_authenticate(user=regular_user)
        self.client.credentials(HTTP_X_ACTIVE_ORG_ID=str(self.organisation.id))

        url = reverse("organisation-aws-account-list")
        response = self.client.post(
            url,
            {
                "name": "prod",
                "access_key_id": "AKIAEXAMPLE",
                "secret_access_key": "examplesecret",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_member_can_manage_aws_accounts(self):
        admin_user = self._add_member(
            "adminaws@example.com", OrganisationMemberRole.ADMIN.value
        )
        self.client.force_authenticate(user=admin_user)
        self.client.credentials(HTTP_X_ACTIVE_ORG_ID=str(self.organisation.id))

        url = reverse("organisation-aws-account-list")
        response = self.client.post(
            url,
            {
                "name": "prod",
                "access_key_id": "AKIAEXAMPLE",
                "secret_access_key": "examplesecret",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_guest_cannot_view_members_audit_logs_or_aws_accounts(self):
        guest_user = self._add_member(
            "guestview@example.com", OrganisationMemberRole.GUEST.value
        )
        self.client.force_authenticate(user=guest_user)
        self.client.credentials(HTTP_X_ACTIVE_ORG_ID=str(self.organisation.id))

        for url_name in [
            "organisation-member-list",
            "organisation-audit-log-list",
            "organisation-aws-account-list",
        ]:
            response = self.client.get(reverse(url_name))
            self.assertEqual(
                response.status_code,
                status.HTTP_403_FORBIDDEN,
                msg=f"{url_name} should be forbidden for guests",
            )

    def test_regular_member_can_view_audit_logs_and_aws_accounts(self):
        regular_user = self._add_member(
            "regularview@example.com", OrganisationMemberRole.REGULAR.value
        )
        self.client.force_authenticate(user=regular_user)
        self.client.credentials(HTTP_X_ACTIVE_ORG_ID=str(self.organisation.id))

        for url_name in [
            "organisation-audit-log-list",
            "organisation-aws-account-list",
        ]:
            response = self.client.get(reverse(url_name))
            self.assertEqual(
                response.status_code,
                status.HTTP_200_OK,
                msg=f"{url_name} should be visible to regular members",
            )

    def test_audit_logs_recorded(self):
        # Create a project as admin/owner.
        url = reverse("project-list")
        response = self.client.post(url, {"name": "Logged Project"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Verify audit log was created.
        from organisations.models import AuditLog

        self.assertTrue(
            AuditLog.objects.filter(
                organisation=self.organisation,
                actor=self.user,
                action="project.create",
            ).exists()
        )

    def test_audit_logs_paginated_and_searchable(self):
        from organisations.models import AuditLog

        AuditLog.objects.filter(organisation=self.organisation).delete()
        for index in range(25):
            AuditLog.objects.create(
                organisation=self.organisation,
                actor=self.user,
                action="deployment.trigger" if index % 2 else "project.create",
            )
        url = reverse("organisation-audit-log-list")

        # The page is capped at the requested page size.
        response = self.client.get(url, {"page_size": 10})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()["data"]
        self.assertEqual(body["count"], 25)
        self.assertEqual(len(body["results"]), 10)
        self.assertIsNotNone(body["next"])

        # Search filters server-side by action.
        response = self.client.get(url, {"search": "deployment"})
        body = response.json()["data"]
        self.assertEqual(body["count"], 12)
        self.assertTrue(
            all("deployment" in entry["action"] for entry in body["results"])
        )
