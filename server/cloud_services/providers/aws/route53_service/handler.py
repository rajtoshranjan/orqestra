from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class Route53Handler(BaseAWSHandler):
    """
    Handler for AWS Route 53 Hosted Zone service.
    """

    @property
    def service_id(self) -> str:
        return "route53"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::Route53::HostedZone"

    @property
    def display_name(self) -> str:
        return "Amazon Route 53"

    @property
    def resource_family(self) -> str:
        return "networking"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate Route 53 Hosted Zone configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        node_label = self._fallback_node_name(node)
        if not config.get("hosted_zone_name"):
            problems.append(f"Route 53 {node_label} requires a hosted zone name.")
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for a Route 53 Hosted Zone.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("hosted_zone_name", "Route 53"),
            "connection_count": connection_count,
            "details": [
                {"label": "Type", "value": config.get("zone_type", "public")},
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for a Route 53 Hosted Zone.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "resource"))
        return {
            "resource": {
                "aws_route53_zone": {
                    logical_name: {
                        "name": config.get("hosted_zone_name", "example.com"),
                        "comment": "Managed by Orqestra",
                    }
                }
            }
        }


registry.register(Route53Handler())
