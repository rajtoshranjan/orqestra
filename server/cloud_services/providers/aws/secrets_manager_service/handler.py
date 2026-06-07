from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class SecretsManagerHandler(BaseAWSHandler):
    """
    Handler for AWS Secrets Manager service.
    """

    @property
    def service_id(self) -> str:
        return "secrets-manager"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::SecretsManager::Secret"

    @property
    def display_name(self) -> str:
        return "Secrets Manager"

    @property
    def resource_family(self) -> str:
        return "security"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate Secrets Manager configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        if not config.get("secret_name"):
            problems.append(
                f"Secrets Manager {self._fallback_node_name(node)} requires a secret name."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for a Secrets Manager secret.
        """
        config = node.get("data", {}).get("config", {})
        rotation_enabled = config.get("rotation_enabled", False)
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("secret_name", "Secret"),
            "connection_count": connection_count,
            "details": [
                {
                    "label": "Rotation",
                    "value": "Enabled" if rotation_enabled else "Disabled",
                },
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for a Secrets Manager secret.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "resource"))
        return {
            "resource": {
                "aws_secretsmanager_secret": {
                    logical_name: {
                        "name": config.get("secret_name", "secret"),
                        "description": config.get("description", ""),
                    }
                }
            }
        }


registry.register(SecretsManagerHandler())
