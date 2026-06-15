from django.urls import reverse
from orqestra.tests import BaseTestCase
from rest_framework import status


class AccountsTests(BaseTestCase):
    """Tests for user account operations: login, signup, logout, and token refresh."""

    def test_signup_success(self):
        url = reverse("user-list")
        payload = {
            "email": "newuser@example.com",
            "password": "NewUserPassword123!",
            "name": "New User",
        }
        # Unauthenticate client to test signup.
        self.client.force_authenticate(user=None)
        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["email"], "newuser@example.com")
        self.assertEqual(response.data["name"], "New User")

    def test_login_success(self):
        url = reverse("token-obtain-pair")
        payload = {
            "username": "testuser@example.com",
            "password": "TestPassword123!",
        }
        # Unauthenticate client to test login.
        self.client.force_authenticate(user=None)
        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_get_profile_me(self):
        url = reverse("user-me")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["data"]["email"], "testuser@example.com")
        self.assertEqual(response.data["data"]["name"], "Test User")

    def test_logout_success(self):
        # Obtain refresh token first.
        login_url = reverse("token-obtain-pair")
        payload = {
            "username": "testuser@example.com",
            "password": "TestPassword123!",
        }
        self.client.force_authenticate(user=None)
        login_response = self.client.post(login_url, payload, format="json")
        refresh_token = login_response.data["refresh"]

        # Request logout (requires auth).
        self.client.force_authenticate(user=self.user)
        logout_url = reverse("user-logout")
        response = self.client.post(
            logout_url, {"refresh_token": refresh_token}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_205_RESET_CONTENT)

    def test_update_profile_success(self):
        url = reverse("user-me")
        payload = {
            "name": "Updated Name",
        }
        response = self.client.patch(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["data"]["name"], "Updated Name")

        # Verify database has updated
        self.user.refresh_from_db()
        self.assertEqual(self.user.name, "Updated Name")

    def test_change_password_success(self):
        url = reverse("user-change-password")
        payload = {
            "current_password": "TestPassword123!",
            "new_password": "NewSecurePassword123!",
        }
        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["message"], "Password changed successfully.")

        # Verify password changed
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewSecurePassword123!"))

    def test_change_password_incorrect_current(self):
        url = reverse("user-change-password")
        payload = {
            "current_password": "WrongPassword123!",
            "new_password": "NewSecurePassword123!",
        }
        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("current_password", response.data)
