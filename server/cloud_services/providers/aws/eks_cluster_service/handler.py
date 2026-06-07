from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class EKSClusterHandler(BaseAWSHandler):
    """
    Handler for AWS EKS Cluster service.
    """

    @property
    def service_id(self) -> str:
        return "eks-cluster"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::EKS::Cluster"

    @property
    def display_name(self) -> str:
        return "Amazon EKS"

    @property
    def resource_family(self) -> str:
        return "compute"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate EKS Cluster configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        node_label = self._fallback_node_name(node)
        if not config.get("cluster_name"):
            problems.append(f"EKS Cluster {node_label} requires a cluster name.")
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for an EKS Cluster.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("cluster_name", "EKS Cluster"),
            "connection_count": connection_count,
            "details": [
                {
                    "label": "K8s Version",
                    "value": config.get("kubernetes_version", "1.30"),
                },
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for an EKS Cluster.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "resource"))
        return {
            "resource": {
                "aws_eks_cluster": {
                    logical_name: {
                        "name": config.get("cluster_name", "eks-cluster"),
                        "version": config.get("kubernetes_version", "1.30"),
                        "role_arn": "ROLE_ARN_PLACEHOLDER",
                    }
                }
            }
        }


registry.register(EKSClusterHandler())
