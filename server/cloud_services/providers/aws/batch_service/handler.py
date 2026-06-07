from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class BatchHandler(BaseAWSHandler):
    """
    Handler for AWS Batch Compute Environment service.
    """

    @property
    def service_id(self) -> str:
        return "batch"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::Batch::ComputeEnvironment"

    @property
    def display_name(self) -> str:
        return "AWS Batch"

    @property
    def resource_family(self) -> str:
        return "compute"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate Batch Compute Environment configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        node_label = self._fallback_node_name(node)
        if not config.get("compute_environment_name"):
            problems.append(f"Batch {node_label} requires a compute environment name.")
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for a Batch Compute Environment.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("compute_environment_name", "Batch"),
            "connection_count": connection_count,
            "details": [
                {
                    "label": "Compute Type",
                    "value": config.get("compute_type", "FARGATE"),
                },
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for a Batch Compute Environment.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "resource"))
        return {
            "resource": {
                "aws_batch_compute_environment": {
                    logical_name: {
                        "compute_environment_name": config.get(
                            "compute_environment_name", "batch-env"
                        ),
                        "type": "MANAGED",
                        "compute_resources": {
                            "type": config.get("compute_type", "FARGATE"),
                        },
                    }
                }
            }
        }


registry.register(BatchHandler())
