from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class CodePipelineHandler(BaseAWSHandler):
    """
    Handler for AWS CodePipeline service.
    """

    @property
    def service_id(self) -> str:
        return "codepipeline"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::CodePipeline::Pipeline"

    @property
    def display_name(self) -> str:
        return "AWS CodePipeline"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate CodePipeline configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        if not config.get("pipeline_name"):
            problems.append(
                f"Pipeline {node.get('id', 'unnamed')} requires a pipeline name."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for a CodePipeline.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("pipeline_name", "Pipeline"),
            "connection_count": connection_count,
            "details": [
                {"label": "Type", "value": config.get("pipeline_type", "V2")},
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for a CodePipeline.
        """
        config = node["data"]["config"]
        logical_name = self.sanitize_resource_name(node["id"])

        return {
            "resource": {
                "aws_codepipeline": {
                    logical_name: {
                        "name": config.get("pipeline_name", "pipeline"),
                        "pipeline_type": config.get("pipeline_type", "V2"),
                        "role_arn": "ROLE_PLACEHOLDER",
                        "artifact_store": {
                            "location": "BUCKET_PLACEHOLDER",
                            "type": "S3",
                        },
                        "stage": [
                            {
                                "name": "Source",
                                "action": [
                                    {
                                        "name": "Source",
                                        "category": "Source",
                                        "owner": "AWS",
                                        "provider": "CodeStarSourceConnection",
                                        "version": "1",
                                        "output_artifacts": ["source"],
                                    }
                                ],
                            }
                        ],
                    }
                }
            }
        }


registry.register(CodePipelineHandler())
