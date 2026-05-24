import logging
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import RequestPayloadSerializer
from .validators import validate_diagram
from .services import plan_diagram, deploy_diagram

logger = logging.getLogger(__name__)


class HealthCheckView(APIView):
    """Health check endpoint."""

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response({"ok": True})


class PlanView(APIView):
    """Validate a diagram and return a deployment plan."""

    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = RequestPayloadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"error": "Request body must be valid JSON."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        diagram = serializer.validated_data["diagram"]
        nodes = diagram.get("nodes", [])
        edges = diagram.get("edges", [])

        errors = validate_diagram(nodes)
        resources = plan_diagram(nodes, edges)

        response_data = {
            "valid": len(errors) == 0,
            "errors": errors,
            "resources": resources,
        }

        response_status = (
            status.HTTP_200_OK
            if len(errors) == 0
            else status.HTTP_422_UNPROCESSABLE_ENTITY
        )

        return Response(response_data, status=response_status)


class DeployView(APIView):
    """Deploy resources from a diagram."""

    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = RequestPayloadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "error": "Request body must be valid JSON.",
                    "logs": [
                        {
                            "level": "error",
                            "message": "Request body must be valid JSON.",
                        }
                    ],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        diagram = serializer.validated_data["diagram"]
        nodes = diagram.get("nodes", [])
        edges = diagram.get("edges", [])
        settings = diagram.get("deployment_settings", {})

        # Check for empty diagram.
        if not nodes:
            return Response(
                {
                    "error": "The diagram does not contain any resources.",
                    "logs": [
                        {
                            "level": "error",
                            "message": "Add at least one resource node before deploying.",
                        }
                    ],
                },
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        # Validate diagram.
        errors = validate_diagram(nodes)
        if errors:
            logs = [{"level": "error", "message": msg} for msg in errors]
            return Response(
                {
                    "error": "The diagram contains invalid configuration.",
                    "logs": logs,
                },
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        # Deploy each node.
        logs = []
        try:
            deploy_diagram(nodes, edges, settings, logs)
        except Exception as e:
            error_message = str(e)
            # Ensure the error is in the logs
            if not any(log.get("message") == error_message for log in logs):
                logs.append({"level": "error", "message": error_message})
            return Response(
                {"error": error_message, "logs": logs},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({"logs": logs})
