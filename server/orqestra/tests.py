from rest_framework.test import APITestCase

from accounts.models import User
from organisations.models import Organisation


class BaseTestCase(APITestCase):
    """
    Base test case providing setup and helper utilities for Orqestra tests.
    """

    def setUp(self):
        super().setUp()
        self.user = User.objects.create_user(
            email="testuser@example.com",
            password="TestPassword123!",
            name="Test User",
        )
        self.organisation = Organisation.objects.filter(owner=self.user).first()
        if not self.organisation:
            self.organisation = Organisation.objects.create(
                name="Test Organisation",
                owner=self.user,
            )
        self.client.force_authenticate(user=self.user)
        self.client.credentials(HTTP_X_ACTIVE_ORG_ID=str(self.organisation.id))

    def _make_valid_lambda_node(self, node_id="node-1", function_name="my-func"):
        """Helper to create a valid Lambda diagram node payload."""
        return {
            "id": node_id,
            "type": "lambda",
            "data": {
                "kind": "lambda",
                "label": "Lambda",
                "config": {
                    "function_name": function_name,
                    "runtime": "nodejs20.x",
                    "handler": "index.handler",
                    "code": "exports.handler = async () => ({ statusCode: 200 });",
                    "environment_variables": [],
                    "memory_size": 128,
                    "timeout": 3,
                    "description": "Test function",
                },
            },
        }
