from unittest.mock import patch

from django.urls import reverse
from orqestra.tests import BaseTestCase
from projects.models import Project
from rest_framework import status

from .models import Deployment, DeploymentStatus, ProjectDeploymentState


class DeploymentTests(BaseTestCase):
    """Tests for the deployments app, services, and endpoints."""

    def setUp(self):
        super().setUp()
        self.project = Project.objects.create(
            name="Test Project",
            description="Testing IaC",
            nodes=[self._make_valid_lambda_node("lambda-1", "test-function")],
            edges=[],
            deployment_settings={"region": "us-west-2"},
        )

    @patch("deployments.services.requests.post")
    def test_create_deployment_success(self, mock_post):
        # Mock successful deployer invocation
        mock_post.return_value.status_code = 202
        mock_post.return_value.text = "Accepted"

        url = reverse("deployment-create")
        response = self.client.post(
            url, {"project_id": str(self.project.id)}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data["status"], DeploymentStatus.INVOKING)
        self.assertEqual(str(response.data["project"]), str(self.project.id))

        # Check DB states
        deployment = Deployment.objects.get(id=response.data["id"])
        self.assertEqual(deployment.status, DeploymentStatus.INVOKING)
        self.assertIsNotNone(deployment.tofu_config)
        self.assertEqual(len(deployment.logs), 3)  # Init, generated, and invoked

    @patch("deployments.services.requests.post")
    def test_create_deployment_deployer_failure(self, mock_post):
        # Mock failed deployer invocation
        mock_post.return_value.status_code = 500
        mock_post.return_value.text = "Internal Server Error"

        url = reverse("deployment-create")
        response = self.client.post(
            url, {"project_id": str(self.project.id)}, format="json"
        )

        # Even if deployer fails, Django handles the exception, updates record to failed, and returns 202 or 500?
        # In services.py, exception is caught, deployment status set to FAILED and saved.
        # So view returns 202 with status=FAILED. Let's assert that!
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data["status"], DeploymentStatus.FAILED)

        deployment = Deployment.objects.get(id=response.data["id"])
        self.assertEqual(deployment.status, DeploymentStatus.FAILED)
        self.assertTrue("Internal Server Error" in deployment.error_message)

    def test_create_deployment_concurrent_prevented(self):
        # Create an active deployment
        Deployment.objects.create(
            project=self.project, status=DeploymentStatus.IN_PROGRESS, graph_snapshot={}
        )

        url = reverse("deployment-create")
        response = self.client.post(
            url, {"project_id": str(self.project.id)}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("already in progress", response.data["error"])

    def test_deployment_detail_view(self):
        deployment = Deployment.objects.create(
            project=self.project, status=DeploymentStatus.PENDING, graph_snapshot={}
        )

        url = reverse("deployment-detail", kwargs={"pk": str(deployment.id)})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], str(deployment.id))

    def test_deployment_callback_succeeded(self):
        deployment = Deployment.objects.create(
            project=self.project,
            status=DeploymentStatus.INVOKING,
            graph_snapshot={
                "nodes": self.project.nodes,
                "edges": self.project.edges,
                "settings": self.project.deployment_settings,
            },
        )

        callback_payload = {
            "status": "succeeded",
            "logs": [
                {
                    "level": "info",
                    "message": "Applying config...",
                    "timestamp": "2026-06-01T00:00:00Z",
                }
            ],
            "tofu_state": {
                "resources": [
                    {
                        "type": "aws_lambda_function",
                        "name": "lambda-1",
                        "instances": [
                            {
                                "attributes": {
                                    "arn": "arn:aws:lambda:us-west-2:123456789012:function:test-function",
                                    "id": "test-function",
                                }
                            }
                        ],
                    }
                ]
            },
            "plan_output": "Plan: 1 to add",
            "error_message": "",
            "outputs": {},
        }

        url = reverse("deployment-callback", kwargs={"pk": str(deployment.id)})
        response = self.client.post(url, callback_payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "succeeded")

        # Verify project state was created
        state = ProjectDeploymentState.objects.get(project=self.project)
        self.assertEqual(state.last_deployment.id, deployment.id)
        self.assertEqual(state.resources.count(), 1)

        resource = state.resources.first()
        self.assertEqual(resource.node_id, "lambda-1")
        self.assertEqual(resource.service_id, "lambda")
        self.assertEqual(
            resource.resource_identifier,
            "arn:aws:lambda:us-west-2:123456789012:function:test-function",
        )

    def test_deployment_callback_failed(self):
        deployment = Deployment.objects.create(
            project=self.project,
            status=DeploymentStatus.INVOKING,
            graph_snapshot={
                "nodes": self.project.nodes,
                "edges": self.project.edges,
                "settings": self.project.deployment_settings,
            },
        )

        callback_payload = {
            "status": "failed",
            "logs": [
                {
                    "level": "error",
                    "message": "Failed to apply",
                    "timestamp": "2026-06-01T00:00:00Z",
                }
            ],
            "tofu_state": None,
            "plan_output": "",
            "error_message": "OpenTofu apply failed",
            "outputs": {},
        }

        url = reverse("deployment-callback", kwargs={"pk": str(deployment.id)})
        response = self.client.post(url, callback_payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "failed")
        self.assertEqual(response.data["error_message"], "OpenTofu apply failed")

        # Verify project state was NOT created
        self.assertFalse(
            ProjectDeploymentState.objects.filter(project=self.project).exists()
        )

    def test_project_deployments_list(self):
        deployment1 = Deployment.objects.create(
            project=self.project, status=DeploymentStatus.SUCCEEDED, graph_snapshot={}
        )
        deployment2 = Deployment.objects.create(
            project=self.project, status=DeploymentStatus.FAILED, graph_snapshot={}
        )

        url = reverse(
            "project-deployments", kwargs={"project_id": str(self.project.id)}
        )
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_project_deployment_state_empty(self):
        url = reverse(
            "project-deployment-state", kwargs={"project_id": str(self.project.id)}
        )
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["deployed"])
        self.assertEqual(len(response.data["resources"]), 0)
