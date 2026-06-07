from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class KMSHandler(BaseAWSHandler):
    """
    Handler for AWS KMS Key service.
    """

    @property
    def service_id(self) -> str:
        return "kms"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::KMS::Key"

    @property
    def display_name(self) -> str:
        return "AWS KMS"

    @property
    def resource_family(self) -> str:
        return "security"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate KMS Key configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        node_label = self._fallback_node_name(node)
        key_alias = config.get("key_alias", "")
        if not key_alias:
            problems.append(f"KMS Key {node_label} requires a key alias.")
        elif not key_alias.startswith("alias/"):
            problems.append(f"KMS Key {node_label} alias must start with 'alias/'.")
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for a KMS Key.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("key_alias", "KMS Key"),
            "connection_count": connection_count,
            "details": [
                {
                    "label": "Key Usage",
                    "value": config.get("key_usage", "ENCRYPT_DECRYPT"),
                },
                {
                    "label": "Multi-Region",
                    "value": "Yes" if config.get("multi_region") else "No",
                },
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for a KMS Key and its alias.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "resource"))
        alias_logical = f"{logical_name}_alias"
        return {
            "resource": {
                "aws_kms_key": {
                    logical_name: {
                        "description": config.get("description", ""),
                        "key_usage": config.get("key_usage", "ENCRYPT_DECRYPT"),
                        "multi_region": config.get("multi_region", False),
                        "enable_key_rotation": config.get("enable_key_rotation", True),
                    }
                },
                "aws_kms_alias": {
                    alias_logical: {
                        "name": config.get("key_alias", "alias/my-key"),
                        "target_key_id": f"${{aws_kms_key.{logical_name}.key_id}}",
                    }
                },
            }
        }


registry.register(KMSHandler())
