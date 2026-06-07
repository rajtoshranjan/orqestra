from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class ALBHandler(BaseAWSHandler):
    """
    Handler for AWS Application/Network Load Balancer service.
    """

    @property
    def service_id(self) -> str:
        return "alb"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::ElasticLoadBalancingV2::LoadBalancer"

    @property
    def display_name(self) -> str:
        return "Load Balancer"

    @property
    def resource_family(self) -> str:
        return "networking"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate Load Balancer configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        if not config.get("load_balancer_name"):
            problems.append(
                f"Load Balancer {self._fallback_node_name(node)} requires a name."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for a Load Balancer.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("load_balancer_name", "Load Balancer"),
            "connection_count": connection_count,
            "details": [
                {"label": "Scheme", "value": config.get("scheme", "internet-facing")},
                {
                    "label": "Type",
                    "value": config.get("load_balancer_type", "application"),
                },
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for a Load Balancer.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "resource"))
        scheme = config.get("scheme", "internet-facing")
        lb_type = config.get("load_balancer_type", "application")
        return {
            "resource": {
                "aws_lb": {
                    logical_name: {
                        "name": config.get("load_balancer_name", "load-balancer"),
                        "internal": scheme == "internal",
                        "load_balancer_type": lb_type,
                    }
                }
            }
        }


registry.register(ALBHandler())
