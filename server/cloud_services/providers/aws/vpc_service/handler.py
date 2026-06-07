from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class VPCHandler(BaseAWSHandler):
    """
    Handler for AWS VPC service.
    """

    @property
    def service_id(self) -> str:
        return "vpc"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::EC2::VPC"

    @property
    def display_name(self) -> str:
        return "AWS VPC"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate VPC configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        cidr = config.get("cidr_block", "")
        if not cidr:
            problems.append(
                f"VPC {self._fallback_node_name(node)} is missing a CIDR block."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build the planning details representation for a VPC.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("vpc_name", "VPC"),
            "connection_count": connection_count,
            "details": [{"label": "CIDR", "value": config.get("cidr_block", "")}],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for a VPC.
        """
        config = node["data"]["config"]
        logical_name = self.sanitize_resource_name(node["id"])
        return {
            "resource": {
                "aws_vpc": {
                    logical_name: {
                        "cidr_block": config.get("cidr_block", "10.0.0.0/16"),
                        "enable_dns_hostnames": config.get(
                            "enable_dns_hostnames", True
                        ),
                        "enable_dns_support": config.get("enable_dns_support", True),
                        "tags": {"Name": config.get("vpc_name", "vpc")},
                    }
                }
            }
        }


registry.register(VPCHandler())
