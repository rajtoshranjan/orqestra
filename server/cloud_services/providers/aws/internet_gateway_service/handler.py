from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class InternetGatewayHandler(BaseAWSHandler):
    """
    Handler for AWS Internet Gateway service.
    """

    @property
    def service_id(self) -> str:
        return "internet-gateway"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::EC2::InternetGateway"

    @property
    def display_name(self) -> str:
        return "Internet Gateway"

    @property
    def resource_family(self) -> str:
        return "networking"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate Internet Gateway configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        if not config.get("gateway_name"):
            problems.append(
                f"Internet Gateway {self._fallback_node_name(node)} requires a name."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for an Internet Gateway.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("gateway_name", "Internet Gateway"),
            "connection_count": connection_count,
            "details": [],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for an Internet Gateway.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "resource"))
        return {
            "resource": {
                "aws_internet_gateway": {
                    logical_name: {
                        "tags": {"Name": config.get("gateway_name", "internet-gateway")}
                    }
                }
            }
        }


registry.register(InternetGatewayHandler())
