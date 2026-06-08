from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class NLBHandler(BaseAWSHandler):
    """
    Handler for AWS Network Load Balancer (NLB) service.
    """

    @property
    def service_id(self) -> str:
        return "nlb"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::ElasticLoadBalancingV2::LoadBalancer"

    @property
    def display_name(self) -> str:
        return "Network Load Balancer"

    @property
    def resource_family(self) -> str:
        return "networking"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate NLB configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        node_name = self._fallback_node_name(node)

        if not config.get("loadBalancerName", "").strip():
            problems.append(
                f"Load Balancer {node_name} is missing a load balancer name."
            )

        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build NLB planning details.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("loadBalancerName", "NLB"),
            "connection_count": connection_count,
            "details": [
                {"label": "Scheme", "value": config.get("scheme", "internal")},
                {
                    "label": "IP Address Type",
                    "value": config.get("ipAddressType", "ipv4"),
                },
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for NLB.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "nlb"))

        edges = edges or []
        nodes = nodes or []
        subnets = []

        # Find connected subnets
        for edge in edges:
            if edge.get("source") == node["id"] or edge.get("target") == node["id"]:
                connected_id = (
                    edge["source"] if edge["target"] == node["id"] else edge["target"]
                )
                for other_node in nodes:
                    if (
                        other_node["id"] == connected_id
                        and other_node.get("data", {}).get("service_id") == "subnet"
                    ):
                        subnets.append(self.sanitize_resource_name(other_node["id"]))

        resource_config = {
            "name": config.get("loadBalancerName", ""),
            "load_balancer_type": "network",
            "internal": config.get("scheme", "internal") == "internal",
            "ip_address_type": config.get("ipAddressType", "ipv4"),
            "tags": {
                "Name": config.get("loadBalancerName", "nlb"),
            },
        }

        if subnets:
            resource_config["subnets"] = [
                f"${{aws_subnet.{sub}.id}}" for sub in subnets
            ]
        else:
            resource_config["subnets"] = ["${aws_subnet.subnet_1.id}"]

        return {"resource": {"aws_lb": {logical_name: resource_config}}}


# Auto-register handler when this module is imported.
registry.register(NLBHandler())
