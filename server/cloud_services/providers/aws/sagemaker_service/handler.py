from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class SageMakerHandler(BaseAWSHandler):
    """
    Handler for Amazon SageMaker Notebook Instance service.
    """

    @property
    def service_id(self) -> str:
        return "sagemaker"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::SageMaker::NotebookInstance"

    @property
    def display_name(self) -> str:
        return "Amazon SageMaker"

    @property
    def resource_family(self) -> str:
        return "general"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate SageMaker Notebook Instance configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        node_name = self._fallback_node_name(node)

        if not config.get("notebookName", "").strip():
            problems.append(
                f"SageMaker Notebook {node_name} is missing a notebook name."
            )
        if not config.get("instanceType", "").strip():
            problems.append(
                f"SageMaker Notebook {node_name} is missing an instance type."
            )

        volume_size = config.get("volumeSizeGb", 0)
        if int(volume_size) < 5:
            problems.append(
                f"SageMaker Notebook {node_name} requires a volume size of at least 5 GiB."
            )

        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build SageMaker planning details.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("notebookName", "SageMaker Notebook"),
            "connection_count": connection_count,
            "details": [
                {"label": "Instance Type", "value": config.get("instanceType", "")},
                {
                    "label": "Volume Size",
                    "value": f"{config.get('volumeSizeGb', 20)} GB",
                },
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for SageMaker Notebook Instance.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "sagemaker"))
        role_arn = settings.get(
            "execution_role_arn",
            "arn:aws:iam::123456789012:role/SageMakerExecutionRole",
        )
        return {
            "resource": {
                "aws_sagemaker_notebook_instance": {
                    logical_name: {
                        "name": config.get("notebookName", ""),
                        "instance_type": config.get("instanceType", "ml.t3.medium"),
                        "role_arn": role_arn,
                        "volume_size": int(config.get("volumeSizeGb", 20)),
                        "tags": {
                            "Name": config.get("notebookName", "sagemaker-notebook"),
                        },
                    }
                }
            }
        }


# Auto-register handler when this module is imported.
registry.register(SageMakerHandler())
