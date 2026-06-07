from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class NatGatewayHandler(BaseAWSHandler):
    """
    Handler for AWS NAT Gateway service.
    """

    @property
    def service_id(self) -> str:
        return "nat-gateway"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::EC2::NatGateway"

    @property
    def display_name(self) -> str:
        return "AWS NAT Gateway"

    @property
    def resource_family(self) -> str:
        return "networking"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate NAT Gateway configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        if not config.get("nat_gateway_name"):
            problems.append(
                f"NAT Gateway {self._fallback_node_name(node)} requires a name."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for a NAT Gateway.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("nat_gateway_name", "NAT Gateway"),
            "connection_count": connection_count,
            "details": [
                {
                    "label": "Connectivity",
                    "value": config.get("connectivity_type", "public").capitalize(),
                },
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for a NAT Gateway.

        Subnet and EIP references require graph traversal and are left as
        placeholder strings to be resolved during full deployment generation.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "resource"))
        return {
            "resource": {
                "aws_nat_gateway": {
                    logical_name: {
                        "allocation_id": "<EIP_ALLOCATION_ID>",
                        "subnet_id": "<SUBNET_ID>",
                        "connectivity_type": config.get("connectivity_type", "public"),
                        "tags": {"Name": config.get("nat_gateway_name", "nat-gateway")},
                    }
                }
            }
        }


registry.register(NatGatewayHandler())
