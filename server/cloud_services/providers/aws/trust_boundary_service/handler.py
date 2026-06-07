from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class TrustBoundaryHandler(BaseAWSHandler):
    """
    Handler for AWS Trust Boundary container/meta service.
    """

    @property
    def service_id(self) -> str:
        return "trust-boundary"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::TrustBoundary"

    @property
    def display_name(self) -> str:
        return "Trust Boundary"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate Trust Boundary configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        if not config.get("boundary_name"):
            problems.append(
                f"Trust Boundary {self._fallback_node_name(node)} requires a boundary name."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for a Trust Boundary.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("boundary_name", "TrustBoundary"),
            "connection_count": connection_count,
            "details": [
                {"label": "Boundary Name", "value": config.get("boundary_name", "")},
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for a Trust Boundary (no resources created directly).
        """
        return {"resource": {}}


registry.register(TrustBoundaryHandler())
