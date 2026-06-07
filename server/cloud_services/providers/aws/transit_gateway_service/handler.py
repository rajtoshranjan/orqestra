from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class TransitGatewayHandler(BaseAWSHandler):
    """
    Handler for AWS EC2 Transit Gateway service.
    """

    @property
    def service_id(self) -> str:
        return "transit-gateway"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::EC2::TransitGateway"

    @property
    def display_name(self) -> str:
        return "Transit Gateway"

    @property
    def resource_family(self) -> str:
        return "networking"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate Transit Gateway configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        node_label = self._fallback_node_name(node)
        if not config.get("transit_gateway_name"):
            problems.append(f"Transit Gateway {node_label} requires a gateway name.")
        asn = config.get("amazon_side_asn")
        if asn is not None:
            in_private_range = 64512 <= asn <= 65534
            in_extended_range = 4200000000 <= asn <= 4294967294
            if not (in_private_range or in_extended_range):
                problems.append(
                    f"Transit Gateway {node_label} ASN must be in range "
                    "64512\u201365534 or 4200000000\u20134294967294."
                )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for a Transit Gateway.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("transit_gateway_name", "Transit Gateway"),
            "connection_count": connection_count,
            "details": [
                {"label": "ASN", "value": str(config.get("amazon_side_asn", 64512))},
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for a Transit Gateway.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "resource"))
        return {
            "resource": {
                "aws_ec2_transit_gateway": {
                    logical_name: {
                        "amazon_side_asn": config.get("amazon_side_asn", 64512),
                        "tags": {
                            "Name": config.get("transit_gateway_name", "tgw"),
                        },
                    }
                }
            }
        }


registry.register(TransitGatewayHandler())
