from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class AZHandler(BaseAWSHandler):
    """
    Handler for AWS Availability Zone container/meta service.
    """

    @property
    def service_id(self) -> str:
        return "availability-zone"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::AZ"

    @property
    def display_name(self) -> str:
        return "AWS AZ"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate Availability Zone configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        if not config.get("zone_name"):
            problems.append(
                f"Availability Zone {self._fallback_node_name(node)} requires a zone name."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for an Availability Zone.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("zone_name", "AZ"),
            "connection_count": connection_count,
            "details": [
                {"label": "AZ Name", "value": config.get("zone_name", "")},
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for an AZ (no resources created directly).
        """
        return {"resource": {}}


registry.register(AZHandler())
