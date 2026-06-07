import logging

from projects.models import Project
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Deployment, ProjectDeploymentState
from .serializers import (
    DeploymentCallbackSerializer,
    DeploymentCreateSerializer,
    DeploymentSerializer,
    ProjectDeploymentStateSerializer,
)
from .services import create_deployment, process_deployment_callback

logger = logging.getLogger(__name__)


class DeploymentViewSet(viewsets.GenericViewSet):
    """
    ViewSet for handling deployment-related operations.
    Conforms to DRF guidelines in agent.md by using framework primitives.
    """

    permission_classes = [AllowAny]
    queryset = Deployment.objects.all()

    def get_serializer_class(self):
        if self.action == "create":
            return DeploymentCreateSerializer
        elif self.action == "callback":
            return DeploymentCallbackSerializer
        elif self.action == "project_state":
            return ProjectDeploymentStateSerializer
        return DeploymentSerializer

    def create(self, request):
        """Create a new deployment for a project (POST /deployments/)."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        project_id = serializer.validated_data["project_id"]

        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response(
                {"error": f"Project '{project_id}' not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Prevent concurrent deployments for the same project.
        active_deployment = Deployment.objects.for_project(project_id).active().first()
        if active_deployment:
            return Response(
                {
                    "error": "A deployment is already in progress for this project.",
                    "active_deployment_id": str(active_deployment.id),
                },
                status=status.HTTP_409_CONFLICT,
            )

        deployment = create_deployment(project)
        return Response(
            DeploymentSerializer(deployment).data,
            status=status.HTTP_202_ACCEPTED,
        )

    def retrieve(self, request, pk=None):
        """Get deployment status and logs (GET /deployments/<pk>/)."""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="callback")
    def callback(self, request, pk=None):
        """Webhook endpoint for the deployer to report results (POST /deployments/<pk>/callback/)."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            deployment = process_deployment_callback(
                deployment_id=pk,
                results=serializer.validated_data,
            )
        except Deployment.DoesNotExist:
            return Response(
                {"error": f"Deployment '{pk}' not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(DeploymentSerializer(deployment).data)

    @action(detail=False, methods=["get"], url_path="project/(?P<project_id>[^/.]+)")
    def project_deployments(self, request, project_id=None):
        """List deployments for a project (GET /deployments/project/<project_id>/)."""
        deployments = Deployment.objects.for_project(project_id).order_by(
            "-created_at"
        )[:20]
        serializer = DeploymentSerializer(deployments, many=True)
        return Response(serializer.data)

    @action(
        detail=False, methods=["get"], url_path="project/(?P<project_id>[^/.]+)/state"
    )
    def project_state(self, request, project_id=None):
        """Get current deployment state for a project (GET /deployments/project/<project_id>/state/)."""
        try:
            state = (
                ProjectDeploymentState.objects.select_related("last_deployment")
                .prefetch_related("resources")
                .get(project_id=project_id)
            )
        except ProjectDeploymentState.DoesNotExist:
            return Response(
                {"deployed": False, "last_deployment": None, "resources": []},
            )

        serializer = self.get_serializer(state)
        return Response(serializer.data)
