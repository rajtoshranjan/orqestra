import hmac

from organisations.helpers import get_active_organisation, log_action
from organisations.permissions import CanWriteOrganisation, IsOrganisationMember
from orqestra.exceptions.api import Conflict
from projects.models import Project
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Deployment, ProjectDeploymentState
from .serializers import (
    DeploymentCallbackSerializer,
    DeploymentCreateSerializer,
    DeploymentSerializer,
    ProjectDeploymentStateSerializer,
)
from .services import (
    create_deployment,
    generate_callback_token,
    process_deployment_callback,
)


class DeploymentViewSet(viewsets.GenericViewSet):
    """Deployment operations, built on DRF primitives."""

    def get_queryset(self):
        active_org = get_active_organisation(self.request)
        return Deployment.objects.filter(
            project__organisation=active_org
        ).select_related("project")

    def get_permissions(self):
        if self.action == "callback":
            self.permission_classes = [AllowAny]
        elif self.action == "create":
            self.permission_classes = [CanWriteOrganisation]
        else:
            self.permission_classes = [IsOrganisationMember]
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action == "create":
            return DeploymentCreateSerializer
        if self.action == "callback":
            return DeploymentCallbackSerializer
        if self.action == "project_state":
            return ProjectDeploymentStateSerializer
        return DeploymentSerializer

    def create(self, request):
        """Create a new deployment for a project (POST /deployments/)."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        project_id = serializer.validated_data["project_id"]
        active_org = get_active_organisation(request)

        try:
            project = Project.objects.get(id=project_id, organisation=active_org)
        except Project.DoesNotExist:
            raise NotFound(f"Project '{project_id}' not found in this organisation.")

        # Prevent concurrent deployments for the same project.
        active_deployment = Deployment.objects.for_project(project_id).active().first()
        if active_deployment:
            raise Conflict(
                {
                    "detail": "A deployment is already in progress for this project.",
                    "active_deployment_id": str(active_deployment.id),
                }
            )

        if not project.aws_account:
            raise ValidationError(
                {
                    "aws_account": (
                        "No AWS account is configured for this project. "
                        "Select one in the project settings before deploying."
                    )
                }
            )

        deployment = create_deployment(project)
        log_action(
            organisation=active_org,
            actor=request.user,
            action="deployment.trigger",
            details={
                "project_id": str(project.id),
                "project_name": project.name,
                "deployment_id": str(deployment.id),
            },
        )
        return Response(
            DeploymentSerializer(deployment).data,
            status=status.HTTP_202_ACCEPTED,
        )

    def retrieve(self, request, pk=None):
        """Get deployment status and logs (GET /deployments/<pk>/)."""
        serializer = self.get_serializer(self.get_object())
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="callback")
    def callback(self, request, pk=None):
        """Webhook for the deployer to report results (POST /deployments/<pk>/callback/)."""
        token = request.query_params.get("token")
        if not token or not hmac.compare_digest(token, generate_callback_token(pk)):
            raise PermissionDenied("Callback token is missing or invalid.")

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            deployment = process_deployment_callback(
                deployment_id=pk,
                results=serializer.validated_data,
            )
        except Deployment.DoesNotExist:
            raise NotFound(f"Deployment '{pk}' not found.")

        return Response(DeploymentSerializer(deployment).data)

    @action(
        detail=False, methods=["get"], url_path="project/(?P<project_id>[^/.]+)/state"
    )
    def project_state(self, request, project_id=None):
        """Get the current deployment state for a project."""
        active_org = get_active_organisation(request)
        try:
            project = Project.objects.get(id=project_id, organisation=active_org)
        except Project.DoesNotExist:
            raise NotFound()

        try:
            state = (
                ProjectDeploymentState.objects.select_related("last_deployment")
                .prefetch_related("resources")
                .get(project_id=project.id)
            )
        except ProjectDeploymentState.DoesNotExist:
            return Response(
                {"deployed": False, "last_deployment": None, "resources": []},
            )

        serializer = self.get_serializer(state)
        return Response(serializer.data)
