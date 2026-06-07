from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class CognitoHandler(BaseAWSHandler):
    """
    Handler for Amazon Cognito User Pool service.
    """

    @property
    def service_id(self) -> str:
        return "cognito"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::Cognito::UserPool"

    @property
    def display_name(self) -> str:
        return "Amazon Cognito"

    @property
    def resource_family(self) -> str:
        return "security"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate Cognito User Pool configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        if not config.get("user_pool_name"):
            problems.append(
                f"Cognito {self._fallback_node_name(node)} requires a user pool name."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for a Cognito User Pool.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("user_pool_name", "User Pool"),
            "connection_count": connection_count,
            "details": [
                {
                    "label": "MFA",
                    "value": config.get("mfa_configuration", "OFF"),
                },
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for a Cognito User Pool.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "resource"))
        return {
            "resource": {
                "aws_cognito_user_pool": {
                    logical_name: {
                        "name": config.get("user_pool_name", "user-pool"),
                        "mfa_configuration": config.get("mfa_configuration", "OFF"),
                    }
                }
            }
        }


registry.register(CognitoHandler())
