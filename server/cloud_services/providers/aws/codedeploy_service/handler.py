from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class CodeDeployHandler(BaseAWSHandler):
    """
    Handler for AWS CodeDeploy service.
    """

    @property
    def service_id(self) -> str:
        return "codedeploy"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::CodeDeploy::Application"

    @property
    def display_name(self) -> str:
        return "AWS CodeDeploy"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate CodeDeploy application configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        if not config.get("application_name"):
            problems.append(
                f"CodeDeploy application {node.get('id', 'unnamed')} requires an application name."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for a CodeDeploy application.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("application_name", "Application"),
            "connection_count": connection_count,
            "details": [
                {"label": "Platform", "value": config.get("compute_platform", "ECS")},
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for a CodeDeploy application.
        """
        config = node["data"]["config"]
        logical_name = self.sanitize_resource_name(node["id"])

        return {
            "resource": {
                "aws_codedeploy_app": {
                    logical_name: {
                        "name": config.get("application_name", "deploy-app"),
                        "compute_platform": config.get("compute_platform", "ECS"),
                    }
                }
            }
        }


registry.register(CodeDeployHandler())
