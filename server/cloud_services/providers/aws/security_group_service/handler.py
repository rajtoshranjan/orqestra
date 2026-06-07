from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class SecurityGroupHandler(BaseAWSHandler):
    """
    Handler for AWS Security Group service.
    """

    @property
    def service_id(self) -> str:
        return "security-group"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::EC2::SecurityGroup"

    @property
    def display_name(self) -> str:
        return "AWS Security Group"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate Security Group configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        if not config.get("group_name"):
            problems.append(
                f"Security Group {self._fallback_node_name(node)} requires a group name."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for a Security Group.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("group_name", "Security Group"),
            "connection_count": connection_count,
            "details": [
                {
                    "label": "Ingress Rules",
                    "value": str(len(config.get("ingress_rules", []))),
                },
                {
                    "label": "Egress Rules",
                    "value": str(len(config.get("egress_rules", []))),
                },
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for a Security Group.
        """
        config = node["data"]["config"]
        logical_name = self.sanitize_resource_name(node["id"])

        # Resolve VPC dependency via hierarchy first, then connection edge fallback.
        vpc_logical = None
        parent_id = node.get("parentNode") or node.get("data", {}).get(
            "config", {}
        ).get("parentId")
        if parent_id:
            for n in nodes or []:
                if (
                    n["id"] == parent_id
                    and n.get("data", {}).get("service_id") == "vpc"
                ):
                    vpc_logical = self.sanitize_resource_name(n["id"])

        if not vpc_logical:
            for edge in edges or []:
                if edge.get("source") == node["id"] or edge.get("target") == node["id"]:
                    connected_id = (
                        edge["source"]
                        if edge["target"] == node["id"]
                        else edge["target"]
                    )
                    for n in nodes or []:
                        if (
                            n["id"] == connected_id
                            and n.get("data", {}).get("service_id") == "vpc"
                        ):
                            vpc_logical = self.sanitize_resource_name(n["id"])

        vpc_id_ref = f"${{aws_vpc.{vpc_logical}.id}}" if vpc_logical else ""

        ingress = []
        for r in config.get("ingress_rules", []):
            ingress.append(
                {
                    "from_port": r.get("from_port", 0),
                    "to_port": r.get("to_port", 0),
                    "protocol": r.get("protocol", "tcp"),
                    "cidr_blocks": [r.get("cidr_block", "0.0.0.0/0")],
                }
            )

        egress = []
        for r in config.get("egress_rules", []):
            egress.append(
                {
                    "from_port": r.get("from_port", 0),
                    "to_port": r.get("to_port", 0),
                    "protocol": r.get("protocol", "-1"),
                    "cidr_blocks": [r.get("cidr_block", "0.0.0.0/0")],
                }
            )

        sg_config = {
            "name": config.get("group_name", "sg"),
            "description": config.get("description", "Managed by Orqestra"),
        }
        if vpc_id_ref:
            sg_config["vpc_id"] = vpc_id_ref
        if ingress:
            sg_config["ingress"] = ingress
        if egress:
            sg_config["egress"] = egress

        return {"resource": {"aws_security_group": {logical_name: sg_config}}}


registry.register(SecurityGroupHandler())
