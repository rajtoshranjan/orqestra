from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class ElastiCacheHandler(BaseAWSHandler):
    """
    Handler for Amazon ElastiCache Replication Group service.
    """

    @property
    def service_id(self) -> str:
        return "elasticache"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::ElastiCache::ReplicationGroup"

    @property
    def display_name(self) -> str:
        return "Amazon ElastiCache"

    @property
    def resource_family(self) -> str:
        return "database"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate ElastiCache Replication Group configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        node_label = self._fallback_node_name(node)
        if not config.get("cluster_name"):
            problems.append(
                f"ElastiCache Cluster {node_label} requires a cluster name."
            )
        num_nodes = config.get("num_cache_nodes", 0)
        if int(num_nodes) < 1:
            problems.append(
                f"ElastiCache Cluster {node_label} must have at least 1 cache node."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for an ElastiCache Replication Group.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("cluster_name", "ElastiCache Cluster"),
            "connection_count": connection_count,
            "details": [
                {"label": "Engine", "value": config.get("engine", "redis")},
                {
                    "label": "Nodes",
                    "value": str(config.get("num_cache_nodes", 1)),
                },
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for an ElastiCache Replication Group.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "resource"))
        return {
            "resource": {
                "aws_elasticache_replication_group": {
                    logical_name: {
                        "replication_group_id": config.get(
                            "cluster_name", "cache-cluster"
                        ),
                        "description": "Managed by Orqestra",
                        "node_type": config.get("cache_node_type", "cache.t3.micro"),
                        "num_cache_clusters": config.get("num_cache_nodes", 1),
                    }
                }
            }
        }


registry.register(ElastiCacheHandler())
