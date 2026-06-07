from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class RouteTableHandler(BaseAWSHandler):
    """
    Handler for AWS Route Table service.
    """

    @property
    def service_id(self) -> str:
        return "route-table"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::EC2::RouteTable"

    @property
    def display_name(self) -> str:
        return "Route Table"

    @property
    def resource_family(self) -> str:
        return "networking"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate Route Table configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        if not config.get("route_table_name"):
            problems.append(
                f"Route Table {self._fallback_node_name(node)} requires a name."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for a Route Table.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("route_table_name", "Route Table"),
            "connection_count": connection_count,
            "details": [],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for a Route Table.

        The VPC reference requires graph traversal and is left as a placeholder
        to be resolved during full deployment generation.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "resource"))
        return {
            "resource": {
                "aws_route_table": {
                    logical_name: {
                        "vpc_id": "<VPC_ID>",
                        "tags": {"Name": config.get("route_table_name", "route-table")},
                    }
                }
            }
        }


registry.register(RouteTableHandler())
