from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class AthenaHandler(BaseAWSHandler):
    """
    Handler for Amazon Athena WorkGroup service.
    """

    @property
    def service_id(self) -> str:
        return "athena"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::Athena::WorkGroup"

    @property
    def display_name(self) -> str:
        return "Amazon Athena"

    @property
    def resource_family(self) -> str:
        return "general"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate Athena WorkGroup configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        node_name = self._fallback_node_name(node)

        if not config.get("workGroupName", "").strip():
            problems.append(
                f"Athena WorkGroup {node_name} is missing a workgroup name."
            )
        if not config.get("outputLocation", "").strip():
            problems.append(
                f"Athena WorkGroup {node_name} is missing an output location."
            )

        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build Athena planning details.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("workGroupName", "Athena Workgroup"),
            "connection_count": connection_count,
            "details": [
                {"label": "Output Location", "value": config.get("outputLocation", "")},
                {
                    "label": "Engine Version",
                    "value": config.get("engineVersion", "AUTO"),
                },
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for Athena WorkGroup.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "athena"))
        return {
            "resource": {
                "aws_athena_workgroup": {
                    logical_name: {
                        "name": config.get("workGroupName", ""),
                        "configuration": {
                            "result_configuration": {
                                "output_location": config.get("outputLocation", ""),
                            }
                        },
                        "tags": {
                            "Name": config.get("workGroupName", "athena-workgroup"),
                        },
                    }
                }
            }
        }


# Auto-register handler when this module is imported.
registry.register(AthenaHandler())
