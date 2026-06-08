from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class VPCEndpointHandler(BaseAWSHandler):
    """
    Handler for AWS VPC Endpoint service.
    """

    @property
    def service_id(self) -> str:
        return "vpc-endpoint"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::EC2::VPCEndpoint"

    @property
    def display_name(self) -> str:
        return "VPC Endpoint"

    @property
    def resource_family(self) -> str:
        return "networking"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate VPC Endpoint configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        node_name = self._fallback_node_name(node)

        if not config.get("endpointName", "").strip():
            problems.append(f"VPC Endpoint {node_name} is missing an endpoint name.")
        if not config.get("serviceName", "").strip():
            problems.append(f"VPC Endpoint {node_name} is missing a service name.")

        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build VPC Endpoint planning details.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("endpointName", "VPC Endpoint"),
            "connection_count": connection_count,
            "details": [
                {
                    "label": "Endpoint Type",
                    "value": config.get("endpointType", "Interface"),
                },
                {"label": "Service Name", "value": config.get("serviceName", "")},
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for VPC Endpoint.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "vpce"))

        edges = edges or []
        nodes = nodes or []
        vpc_logical = None
        subnets = []

        # Find connected VPC and subnets
        for edge in edges:
            if edge.get("source") == node["id"] or edge.get("target") == node["id"]:
                connected_id = (
                    edge["source"] if edge["target"] == node["id"] else edge["target"]
                )
                for other_node in nodes:
                    if other_node["id"] == connected_id:
                        svc_id = other_node.get("data", {}).get("service_id")
                        if svc_id == "vpc":
                            vpc_logical = self.sanitize_resource_name(other_node["id"])
                        elif svc_id == "subnet":
                            subnets.append(
                                self.sanitize_resource_name(other_node["id"])
                            )

        resource_config = {
            "service_name": config.get("serviceName", "com.amazonaws.us-east-1.s3"),
            "vpc_endpoint_type": config.get("endpointType", "Interface"),
            "tags": {
                "Name": config.get("endpointName", "vpc-endpoint"),
            },
        }

        if vpc_logical:
            resource_config["vpc_id"] = f"${{aws_vpc.{vpc_logical}.id}}"
        else:
            resource_config["vpc_id"] = "${aws_vpc.vpc_1.id}"

        # Interface endpoint type typically requires client subnets
        if config.get("endpointType", "Interface") == "Interface":
            if subnets:
                resource_config["subnet_ids"] = [
                    f"${{aws_subnet.{sub}.id}}" for sub in subnets
                ]
            else:
                resource_config["subnet_ids"] = ["${aws_subnet.subnet_1.id}"]

        return {"resource": {"aws_vpc_endpoint": {logical_name: resource_config}}}


# Auto-register handler when this module is imported.
registry.register(VPCEndpointHandler())
