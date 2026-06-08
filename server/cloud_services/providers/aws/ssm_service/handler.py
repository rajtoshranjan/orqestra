from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class SSMHandler(BaseAWSHandler):
    """
    Handler for AWS Systems Manager (SSM) Parameter service.
    """

    @property
    def service_id(self) -> str:
        return "ssm"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::SSM::Parameter"

    @property
    def display_name(self) -> str:
        return "SSM Parameter"

    @property
    def resource_family(self) -> str:
        return "security"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate SSM Parameter configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        node_name = self._fallback_node_name(node)

        if not config.get("parameterName", "").strip():
            problems.append(f"SSM Parameter {node_name} is missing a parameter name.")

        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build SSM Parameter planning details.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("parameterName", "SSM Parameter"),
            "connection_count": connection_count,
            "details": [
                {
                    "label": "Parameter Type",
                    "value": config.get("parameterType", "String"),
                },
                {"label": "Tier", "value": config.get("tier", "Standard")},
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for SSM Parameter.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "ssm"))
        return {
            "resource": {
                "aws_ssm_parameter": {
                    logical_name: {
                        "name": config.get("parameterName", ""),
                        "type": config.get("parameterType", "String"),
                        "value": "CHANGE_ME",
                        "tier": config.get("tier", "Standard"),
                        "tags": {
                            "Name": config.get("parameterName", "ssm-parameter"),
                        },
                    }
                }
            }
        }


# Auto-register handler when this module is imported.
registry.register(SSMHandler())
