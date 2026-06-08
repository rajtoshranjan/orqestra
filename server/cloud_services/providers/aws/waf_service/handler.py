from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class WAFHandler(BaseAWSHandler):
    """
    Handler for AWS WAF Web ACL service.
    """

    @property
    def service_id(self) -> str:
        return "waf"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::WAFv2::WebACL"

    @property
    def display_name(self) -> str:
        return "AWS WAF"

    @property
    def resource_family(self) -> str:
        return "security"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate WAF Web ACL configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        node_name = self._fallback_node_name(node)

        if not config.get("webAclName", "").strip():
            problems.append(f"WAF Web ACL {node_name} is missing a Web ACL name.")

        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build WAF Web ACL planning details.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("webAclName", "WAF Web ACL"),
            "connection_count": connection_count,
            "details": [
                {"label": "Scope", "value": config.get("scope", "REGIONAL")},
                {
                    "label": "Default Action",
                    "value": config.get("defaultAction", "ALLOW"),
                },
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for WAF Web ACL.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "waf"))
        default_action = config.get("defaultAction", "ALLOW")

        action_dict = {}
        if default_action == "ALLOW":
            action_dict["allow"] = {}
        else:
            action_dict["block"] = {}

        return {
            "resource": {
                "aws_wafv2_web_acl": {
                    logical_name: {
                        "name": config.get("webAclName", ""),
                        "scope": config.get("scope", "REGIONAL"),
                        "default_action": [action_dict],
                        "visibility_config": {
                            "cloudwatch_metrics_enabled": True,
                            "metric_name": f"{logical_name}_metric",
                            "sampled_requests_enabled": True,
                        },
                        "tags": {
                            "Name": config.get("webAclName", "waf-web-acl"),
                        },
                    }
                }
            }
        }


# Auto-register handler when this module is imported.
registry.register(WAFHandler())
