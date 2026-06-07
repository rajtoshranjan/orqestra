from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class SubnetHandler(BaseAWSHandler):
    """
    Handler for AWS Subnet service.
    """

    @property
    def service_id(self) -> str:
        return "subnet"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::EC2::Subnet"

    @property
    def display_name(self) -> str:
        return "AWS Subnet"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate Subnet configuration, checking that it resides in a VPC.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        if not config.get("cidr_block"):
            problems.append(
                f"Subnet {self._fallback_node_name(node)} requires a CIDR block."
            )

        # Subnet should be inside or connected to a VPC.
        vpc_connected = False
        parent_id = node.get("parentNode") or node.get("data", {}).get(
            "config", {}
        ).get("parentId")
        if parent_id:
            for n in nodes or []:
                if (
                    n["id"] == parent_id
                    and n.get("data", {}).get("service_id") == "vpc"
                ):
                    vpc_connected = True

        if not vpc_connected:
            edges = edges or []
            for edge in edges:
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
                            vpc_connected = True

        if not vpc_connected:
            problems.append(
                f"Subnet {self._fallback_node_name(node)} must be inside or connected to a VPC container."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for a Subnet.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("subnet_name", "Subnet"),
            "connection_count": connection_count,
            "details": [
                {"label": "CIDR", "value": config.get("cidr_block", "")},
                {"label": "Type", "value": config.get("subnet_type", "private")},
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for a Subnet.
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

        res = {
            "aws_subnet": {
                logical_name: {
                    "vpc_id": vpc_id_ref,
                    "cidr_block": config.get("cidr_block", "10.0.1.0/24"),
                    "availability_zone": config.get("availability_zone", "us-east-1a"),
                    "map_public_ip_on_launch": config.get(
                        "map_public_ip_on_launch", False
                    ),
                    "tags": {"Name": config.get("subnet_name", "subnet")},
                }
            }
        }

        # If it is a public subnet, generate Internet Gateway and Routing.
        if config.get("subnet_type") == "public" and vpc_logical:
            igw_name = f"igw_{vpc_logical}"
            rt_name = f"rt_public_{vpc_logical}"
            res["aws_internet_gateway"] = {
                igw_name: {"vpc_id": vpc_id_ref, "tags": {"Name": f"igw-{vpc_logical}"}}
            }
            res["aws_route_table"] = {
                rt_name: {
                    "vpc_id": vpc_id_ref,
                    "route": [
                        {
                            "cidr_block": "0.0.0.0/0",
                            "gateway_id": f"${{aws_internet_gateway.{igw_name}.id}}",
                        }
                    ],
                    "tags": {"Name": f"rt-public-{vpc_logical}"},
                }
            }
            res["aws_route_table_association"] = {
                f"rta_{logical_name}": {
                    "subnet_id": f"${{aws_subnet.{logical_name}.id}}",
                    "route_table_id": f"${{aws_route_table.{rt_name}.id}}",
                }
            }
        return {"resource": res}


registry.register(SubnetHandler())
