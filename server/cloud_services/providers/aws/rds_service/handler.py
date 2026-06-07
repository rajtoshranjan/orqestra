from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class RDSHandler(BaseAWSHandler):
    """
    Handler for Amazon RDS DB Instance service.
    """

    @property
    def service_id(self) -> str:
        return "rds"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::RDS::DBInstance"

    @property
    def display_name(self) -> str:
        return "Amazon RDS"

    @property
    def resource_family(self) -> str:
        return "database"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate RDS DB Instance configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        node_label = self._fallback_node_name(node)
        if not config.get("instance_identifier"):
            problems.append(
                f"RDS Instance {node_label} requires an instance identifier."
            )
        if not config.get("instance_class"):
            problems.append(f"RDS Instance {node_label} requires an instance class.")
        allocated_storage = config.get("allocated_storage", 0)
        if int(allocated_storage) < 20:
            problems.append(
                f"RDS Instance {node_label} requires at least 20 GiB of allocated storage."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for an RDS DB Instance.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("instance_identifier", "RDS Instance"),
            "connection_count": connection_count,
            "details": [
                {"label": "Engine", "value": config.get("engine", "")},
                {"label": "Instance Class", "value": config.get("instance_class", "")},
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for an RDS DB Instance.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "resource"))
        return {
            "resource": {
                "aws_db_instance": {
                    logical_name: {
                        "identifier": config.get("instance_identifier", "rds-instance"),
                        "engine": config.get("engine", "mysql"),
                        "instance_class": config.get("instance_class", "db.t3.micro"),
                        "allocated_storage": config.get("allocated_storage", 20),
                        "username": "admin",
                        "password": "CHANGE_ME",
                        "skip_final_snapshot": True,
                    }
                }
            }
        }


registry.register(RDSHandler())
