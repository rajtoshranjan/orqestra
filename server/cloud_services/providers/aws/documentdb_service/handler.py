from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class DocumentDbHandler(BaseAWSHandler):
    """
    Handler for Amazon DocumentDB (with MongoDB compatibility) service.
    """

    @property
    def service_id(self) -> str:
        return "documentdb"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::DocDB::DBCluster"

    @property
    def display_name(self) -> str:
        return "Amazon DocumentDB"

    @property
    def resource_family(self) -> str:
        return "database"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate DocumentDB configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        node_name = self._fallback_node_name(node)

        if not config.get("clusterIdentifier", "").strip():
            problems.append(
                f"DocumentDB Cluster {node_name} is missing a cluster identifier."
            )
        if not config.get("instanceClass", "").strip():
            problems.append(
                f"DocumentDB Cluster {node_name} is missing an instance class."
            )

        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build DocumentDB planning details.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("clusterIdentifier", "DocumentDB Cluster"),
            "connection_count": connection_count,
            "details": [
                {
                    "label": "Engine Version",
                    "value": config.get("engineVersion", "5.0.0"),
                },
                {"label": "Instance Class", "value": config.get("instanceClass", "")},
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for DocumentDB.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "docdb"))

        return {
            "resource": {
                "aws_docdb_cluster": {
                    logical_name: {
                        "cluster_identifier": config.get("clusterIdentifier", ""),
                        "engine": "docdb",
                        "engine_version": config.get("engineVersion", "5.0.0"),
                        "master_username": "admin",
                        "master_password": "CHANGE_ME",
                        "skip_final_snapshot": True,
                        "tags": {
                            "Name": config.get("clusterIdentifier", "docdb-cluster"),
                        },
                    }
                },
                "aws_docdb_cluster_instance": {
                    f"{logical_name}_instance_0": {
                        "identifier": f"{config.get('clusterIdentifier', 'docdb-instance')}-0",
                        "cluster_identifier": f"${{aws_docdb_cluster.{logical_name}.id}}",
                        "instance_class": config.get("instanceClass", "db.t3.medium"),
                    }
                },
            }
        }


# Auto-register handler when this module is imported.
registry.register(DocumentDbHandler())
