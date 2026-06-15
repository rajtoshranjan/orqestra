from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .serializers import RequestPayloadSerializer
from .services import plan_diagram
from .validators import validate_diagram


class CloudServicesViewSet(viewsets.ViewSet):
    """Provider-agnostic cloud orchestration endpoints (health, plan)."""

    def get_permissions(self):
        if self.action == "health":
            return [AllowAny()]
        return [IsAuthenticated()]

    @action(detail=False, methods=["get"], url_path="health")
    def health(self, request):
        """Health check endpoint (GET /health)."""
        return Response({"ok": True})

    @action(detail=False, methods=["post"], url_path="plan")
    def plan(self, request):
        """Validate a diagram and return a deployment plan (POST /plan)."""
        serializer = RequestPayloadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        diagram = serializer.validated_data["diagram"]
        nodes = diagram.get("nodes", [])
        edges = diagram.get("edges", [])

        errors = validate_diagram(nodes, edges)
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
