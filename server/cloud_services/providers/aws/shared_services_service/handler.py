from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class SharedServicesHandler(BaseAWSHandler):
    """
    Handler for AWS Shared Services container/meta service.
    """

    @property
    def service_id(self) -> str:
        return "shared-services"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::SharedServices"

    @property
    def display_name(self) -> str:
        return "Shared Services"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate Shared Services configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        if not config.get("services_name"):
            problems.append(
                f"Shared Services {self._fallback_node_name(node)} requires a services name."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for Shared Services.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("services_name", "SharedServices"),
            "connection_count": connection_count,
            "details": [
                {"label": "Boundary Name", "value": config.get("services_name", "")},
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for Shared Services (no resources created directly).
        """
        return {"resource": {}}


registry.register(SharedServicesHandler())
