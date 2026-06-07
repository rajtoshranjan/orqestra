from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class AppGroupHandler(BaseAWSHandler):
    """
    Handler for AWS Application Group container/meta service.
    """

    @property
    def service_id(self) -> str:
        return "app-group"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::AppGroup"

    @property
    def display_name(self) -> str:
        return "Application Group"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate Application Group configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        if not config.get("group_name"):
            problems.append(
                f"Application Group {self._fallback_node_name(node)} requires a group name."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for an Application Group.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("group_name", "AppGroup"),
            "connection_count": connection_count,
            "details": [
                {"label": "Group Name", "value": config.get("group_name", "")},
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for an Application Group (no resources created directly).
        """
        return {"resource": {}}


registry.register(AppGroupHandler())
