from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class NetworkAclHandler(BaseAWSHandler):
    """
    Handler for AWS EC2 Network ACL service.
    """

    @property
    def service_id(self) -> str:
        return "network-acl"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::EC2::NetworkAcl"

    @property
    def display_name(self) -> str:
        return "Network ACL"

    @property
    def resource_family(self) -> str:
        return "networking"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate Network ACL configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        node_label = self._fallback_node_name(node)
        if not config.get("acl_name"):
            problems.append(f"Network ACL {node_label} requires an ACL name.")
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for a Network ACL.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("acl_name", "Network ACL"),
            "connection_count": connection_count,
            "details": [
                {"label": "Default", "value": config.get("default_action", "deny")},
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for a Network ACL.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "resource"))
        return {
            "resource": {
                "aws_network_acl": {
                    logical_name: {
                        "tags": {
                            "Name": config.get("acl_name", "nacl"),
                        },
                    }
                }
            }
        }


registry.register(NetworkAclHandler())
