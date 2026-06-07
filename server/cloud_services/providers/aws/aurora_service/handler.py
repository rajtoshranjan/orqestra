from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class AuroraHandler(BaseAWSHandler):
    """
    Handler for Amazon Aurora DB Cluster service.
    """

    @property
    def service_id(self) -> str:
        return "aurora"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::RDS::DBCluster"

    @property
    def display_name(self) -> str:
        return "Amazon Aurora"

    @property
    def resource_family(self) -> str:
        return "database"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate Aurora DB Cluster configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        node_label = self._fallback_node_name(node)
        if not config.get("cluster_identifier"):
            problems.append(
                f"Aurora Cluster {node_label} requires a cluster identifier."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for an Aurora DB Cluster.
        """
        config = node.get("data", {}).get("config", {})
        serverless = config.get("serverless", False)
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("cluster_identifier", "Aurora Cluster"),
            "connection_count": connection_count,
            "details": [
                {"label": "Engine", "value": config.get("engine", "aurora-postgresql")},
                {"label": "Serverless", "value": "Yes" if serverless else "No"},
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for an Aurora DB Cluster.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "resource"))
        return {
            "resource": {
                "aws_rds_cluster": {
                    logical_name: {
                        "cluster_identifier": config.get(
                            "cluster_identifier", "aurora-cluster"
                        ),
                        "engine": config.get("engine", "aurora-postgresql"),
                        "engine_version": config.get("engine_version", "15.4"),
                        "master_username": "admin",
                        "master_password": "CHANGE_ME",
                        "skip_final_snapshot": True,
                    }
                }
            }
        }


registry.register(AuroraHandler())
