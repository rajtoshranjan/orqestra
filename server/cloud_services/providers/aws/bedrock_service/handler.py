from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class BedrockHandler(BaseAWSHandler):
    """
    Handler for Amazon Bedrock Agent service.
    """

    @property
    def service_id(self) -> str:
        return "bedrock"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::Bedrock::Agent"

    @property
    def display_name(self) -> str:
        return "Amazon Bedrock"

    @property
    def resource_family(self) -> str:
        return "general"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate Bedrock Agent configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        node_name = self._fallback_node_name(node)

        if not config.get("agentName", "").strip():
            problems.append(f"Bedrock Agent {node_name} is missing an agent name.")
        if not config.get("foundationModel", "").strip():
            problems.append(f"Bedrock Agent {node_name} is missing a foundation model.")

        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build Bedrock planning details.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("agentName", "Bedrock Agent"),
            "connection_count": connection_count,
            "details": [
                {"label": "Model", "value": config.get("foundationModel", "")},
                {
                    "label": "Guardrail Mode",
                    "value": config.get("guardrailMode", "NONE"),
                },
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for Bedrock Agent.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "bedrock"))
        role_arn = settings.get(
            "execution_role_arn", "arn:aws:iam::123456789012:role/BedrockExecutionRole"
        )
        return {
            "resource": {
                "aws_bedrockagent_agent": {
                    logical_name: {
                        "agent_name": config.get("agentName", ""),
                        "foundation_model": config.get(
                            "foundationModel", "anthropic.claude-3-sonnet"
                        ),
                        "instruction": "You are a helpful cloud architecture AI agent.",
                        "agent_resource_role_arn": role_arn,
                        "tags": {
                            "Name": config.get("agentName", "bedrock-agent"),
                        },
                    }
                }
            }
        }


# Auto-register handler when this module is imported.
registry.register(BedrockHandler())
