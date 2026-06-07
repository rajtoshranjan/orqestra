from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class AppRunnerHandler(BaseAWSHandler):
    """
    Handler for AWS App Runner service.
    """

    @property
    def service_id(self) -> str:
        return "app-runner"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::AppRunner::Service"

    @property
    def display_name(self) -> str:
        return "AWS App Runner"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate App Runner service configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        if not config.get("service_name"):
            problems.append(
                f"App Runner service {node.get('id', 'unnamed')} requires a service name."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for an App Runner service.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("service_name", "Service"),
            "connection_count": connection_count,
            "details": [
                {"label": "CPU", "value": config.get("cpu", "0.5 vCPU")},
                {"label": "Memory", "value": config.get("memory", "1 GB")},
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for an App Runner service.
        """
        config = node["data"]["config"]
        logical_name = self.sanitize_resource_name(node["id"])

        return {
            "resource": {
                "aws_apprunner_service": {
                    logical_name: {
                        "service_name": config.get("service_name", "app-runner"),
                        "source_configuration": {
                            "image_repository": {
                                "image_identifier": "ECR_URI_PLACEHOLDER",
                                "image_repository_type": "ECR",
                            }
                        },
                        "instance_configuration": {
                            "cpu": config.get("cpu", "0.5 vCPU"),
                            "memory": config.get("memory", "1 GB"),
                        },
                    }
                }
            }
        }


registry.register(AppRunnerHandler())
