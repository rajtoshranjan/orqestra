from unittest.mock import patch

from django.urls import reverse
from orqestra.tests import BaseTestCase
from projects.models import Project
from rest_framework import status

from .models import Deployment, DeploymentStatus, ProjectDeploymentState
from .services import _generate_callback_token


class DeploymentTests(BaseTestCase):
    """Tests for the deployments app, services, and endpoints."""

    def setUp(self):
        super().setUp()
        self.project = Project.objects.create(
            organisation=self.organisation,
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

        token = _generate_callback_token(deployment.id)
        url = (
            reverse("deployment-callback", kwargs={"pk": str(deployment.id)})
            + f"?token={token}"
        )
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

        token = _generate_callback_token(deployment.id)
        url = (
            reverse("deployment-callback", kwargs={"pk": str(deployment.id)})
            + f"?token={token}"
        )
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

    def test_deployment_callback_unauthorized(self):
        deployment = Deployment.objects.create(
            project=self.project,
            status=DeploymentStatus.INVOKING,
            graph_snapshot={},
        )
        url = reverse("deployment-callback", kwargs={"pk": str(deployment.id)})
        # Test missing token
        response = self.client.post(url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Test invalid token
        response = self.client.post(url + "?token=invalidtoken", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class TofuSyncTests(BaseTestCase):
    """Tests for OpenTofu state mapping and resource synchronization."""

    def test_tofu_type_to_service_id(self):
        from .services import _tofu_type_to_service_id

        self.assertEqual(_tofu_type_to_service_id("aws_lambda_function"), "lambda")
        self.assertEqual(_tofu_type_to_service_id("aws_s3_bucket"), "s3")
        self.assertEqual(_tofu_type_to_service_id("aws_dynamodb_table"), "dynamodb")
        self.assertEqual(
            _tofu_type_to_service_id("aws_unknown_type"), "aws_unknown_type"
        )

    def test_sync_deployed_resources(self):
        from .models import ProjectDeploymentState
        from .services import _sync_deployed_resources

        project = Project.objects.create(
            organisation=self.organisation,
            name="Sync Test Project",
            nodes=[
                {
                    "id": "s3-bucket-1",
                    "type": "s3",
                    "data": {
                        "service_id": "s3",
                        "label": "My Bucket",
                        "config": {"bucket_name": "my-bucket"},
                    },
                },
                {
                    "id": "dynamodb-table-2",
                    "type": "dynamodb",
                    "data": {
                        "service_id": "dynamodb",
                        "label": "My Table",
                        "config": {"table_name": "my-table"},
                    },
                },
            ],
            edges=[],
        )

        state = ProjectDeploymentState.objects.create(
            project=project,
            deployed_graph_hash="somehash",
        )

        tofu_state = {
            "resources": [
                {
                    "type": "aws_s3_bucket",
                    "name": "s3_bucket_1",
                    "instances": [
                        {
                            "attributes": {
                                "arn": "arn:aws:s3:::my-bucket-arn",
                                "id": "my-bucket-id",
                            }
                        }
                    ],
                },
                {
                    "type": "aws_dynamodb_table",
                    "name": "dynamodb_table_2",
                    "instances": [
                        {
                            "attributes": {
                                "arn": "arn:aws:dynamodb:us-east-1:123456789012:table/my-table",
                                "id": "my-table-id",
                            }
                        }
                    ],
                },
            ]
        }

        _sync_deployed_resources(state, tofu_state)

        resources = state.resources.all().order_by("service_id")
        self.assertEqual(resources.count(), 2)

        # Assert DynamoDB resource maps to original node_id and correct service_id
        dynamodb_res = resources.filter(service_id="dynamodb").first()
        self.assertIsNotNone(dynamodb_res)
        self.assertEqual(dynamodb_res.node_id, "dynamodb-table-2")
        self.assertEqual(
            dynamodb_res.resource_identifier,
            "arn:aws:dynamodb:us-east-1:123456789012:table/my-table",
        )

        # Assert S3 resource maps to original node_id and correct service_id
        s3_res = resources.filter(service_id="s3").first()
        self.assertIsNotNone(s3_res)
        self.assertEqual(s3_res.node_id, "s3-bucket-1")
        self.assertEqual(s3_res.resource_identifier, "arn:aws:s3:::my-bucket-arn")
