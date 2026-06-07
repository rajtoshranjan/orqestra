from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class RedshiftHandler(BaseAWSHandler):
    """
    Handler for Amazon Redshift Cluster service.
    """

    @property
    def service_id(self) -> str:
        return "redshift"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::Redshift::Cluster"

    @property
    def display_name(self) -> str:
        return "Amazon Redshift"

    @property
    def resource_family(self) -> str:
        return "database"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate Redshift Cluster configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        node_label = self._fallback_node_name(node)
        if not config.get("cluster_identifier"):
            problems.append(
                f"Redshift Cluster {node_label} requires a cluster identifier."
            )
        if not config.get("database_name"):
            problems.append(f"Redshift Cluster {node_label} requires a database name.")
        num_nodes = config.get("number_of_nodes", 0)
        if int(num_nodes) < 1:
            problems.append(f"Redshift Cluster {node_label} must have at least 1 node.")
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for a Redshift Cluster.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("cluster_identifier", "Redshift Cluster"),
            "connection_count": connection_count,
            "details": [
                {"label": "Node Type", "value": config.get("node_type", "dc2.large")},
                {
                    "label": "Nodes",
                    "value": str(config.get("number_of_nodes", 2)),
                },
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for a Redshift Cluster.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "resource"))
        return {
            "resource": {
                "aws_redshift_cluster": {
                    logical_name: {
                        "cluster_identifier": config.get(
                            "cluster_identifier", "redshift-cluster"
                        ),
                        "node_type": config.get("node_type", "dc2.large"),
                        "number_of_nodes": config.get("number_of_nodes", 2),
                        "database_name": config.get("database_name", "dev"),
                        "master_username": "admin",
                        "master_password": "CHANGE_ME",
                        "skip_final_snapshot": True,
                    }
                }
            }
        }


registry.register(RedshiftHandler())
