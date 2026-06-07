from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class CodeBuildHandler(BaseAWSHandler):
    """
    Handler for AWS CodeBuild service.
    """

    @property
    def service_id(self) -> str:
        return "codebuild"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::CodeBuild::Project"

    @property
    def display_name(self) -> str:
        return "AWS CodeBuild"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate CodeBuild project configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        if not config.get("project_name"):
            problems.append(
                f"CodeBuild project {node.get('id', 'unnamed')} requires a project name."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for a CodeBuild project.
        """
        config = node.get("data", {}).get("config", {})
        compute_type = config.get("compute_type", "BUILD_GENERAL1_SMALL")
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("project_name", "Project"),
            "connection_count": connection_count,
            "details": [
                {
                    "label": "Compute",
                    "value": compute_type.replace("BUILD_GENERAL1_", ""),
                },
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for a CodeBuild project.
        """
        config = node["data"]["config"]
        logical_name = self.sanitize_resource_name(node["id"])

        return {
            "resource": {
                "aws_codebuild_project": {
                    logical_name: {
                        "name": config.get("project_name", "build-project"),
                        "service_role": "ROLE_PLACEHOLDER",
                        "source": {
                            "type": "NO_SOURCE",
                            "buildspec": "version: 0.2",
                        },
                        "environment": {
                            "compute_type": config.get(
                                "compute_type", "BUILD_GENERAL1_SMALL"
                            ),
                            "image": config.get(
                                "build_image", "aws/codebuild/standard:7.0"
                            ),
                            "type": "LINUX_CONTAINER",
                        },
                        "artifacts": {
                            "type": "NO_ARTIFACTS",
                        },
                    }
                }
            }
        }


registry.register(CodeBuildHandler())
