from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class RegionHandler(BaseAWSHandler):
    """
    Handler for AWS Region container/meta service.
    """

    @property
    def service_id(self) -> str:
        return "region"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::Region"

    @property
    def display_name(self) -> str:
        return "AWS Region"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate Region configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        if not config.get("region_name"):
            problems.append(
                f"Region {self._fallback_node_name(node)} requires a region name."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for a Region.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("region_name", "Region"),
            "connection_count": connection_count,
            "details": [
                {"label": "Region Name", "value": config.get("region_name", "")},
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for a Region (no resources created directly).
        """
        return {"resource": {}}


registry.register(RegionHandler())
