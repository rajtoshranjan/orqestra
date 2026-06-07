from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class ECRHandler(BaseAWSHandler):
    """
    Handler for AWS ECR Repository service.
    """

    @property
    def service_id(self) -> str:
        return "ecr"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::ECR::Repository"

    @property
    def display_name(self) -> str:
        return "Amazon ECR"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate ECR Repository configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        if not config.get("repository_name"):
            problems.append(
                f"ECR Repository {self._fallback_node_name(node)} requires a repository name."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for an ECR Repository.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("repository_name", "ECR"),
            "connection_count": connection_count,
            "details": [
                {
                    "label": "Mutability",
                    "value": config.get("image_tag_mutability", "MUTABLE"),
                },
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for an ECR Repository.
        """
        config = node["data"]["config"]
        logical_name = self.sanitize_resource_name(node["id"])

        return {
            "resource": {
                "aws_ecr_repository": {
                    logical_name: {
                        "name": config.get("repository_name", "repo"),
                        "image_tag_mutability": config.get(
                            "image_tag_mutability", "MUTABLE"
                        ),
                        "image_scanning_configuration": {
                            "scan_on_push": config.get("scan_on_push", True)
                        },
                    }
                }
            }
        }


registry.register(ECRHandler())
