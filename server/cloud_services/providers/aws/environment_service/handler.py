from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class EnvironmentHandler(BaseAWSHandler):
    """
    Handler for AWS Environment container/meta service.
    """

    @property
    def service_id(self) -> str:
        return "environment"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::Environment"

    @property
    def display_name(self) -> str:
        return "Environment"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate Environment configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        if not config.get("env_name"):
            problems.append(
                f"Environment {self._fallback_node_name(node)} requires an environment name."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for an Environment.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("env_name", "Environment"),
            "connection_count": connection_count,
            "details": [
                {"label": "Environment Name", "value": config.get("env_name", "")},
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for an Environment (no resources created directly).
        """
        return {"resource": {}}


registry.register(EnvironmentHandler())
