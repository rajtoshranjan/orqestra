from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class SESHandler(BaseAWSHandler):
    """
    Handler for Amazon SES Email or Domain Identity service.
    """

    @property
    def service_id(self) -> str:
        return "ses"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::SES::EmailIdentity"

    @property
    def display_name(self) -> str:
        return "Amazon SES"

    @property
    def resource_family(self) -> str:
        return "messaging"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate SES Identity configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        node_name = self._fallback_node_name(node)

        if not config.get("identityName", "").strip():
            problems.append(f"SES Identity {node_name} is missing an identity name.")
        if not config.get("mailFromDomain", "").strip():
            problems.append(f"SES Identity {node_name} is missing a MAIL FROM domain.")

        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build SES planning details.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("identityName", "SES Identity"),
            "connection_count": connection_count,
            "details": [
                {
                    "label": "Identity Type",
                    "value": config.get("identityType", "Domain"),
                },
                {
                    "label": "MAIL FROM Domain",
                    "value": config.get("mailFromDomain", ""),
                },
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for SES.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "ses"))
        identity_type = config.get("identityType", "Domain")

        res = {}
        if identity_type == "Domain":
            res["aws_ses_domain_identity"] = {
                logical_name: {
                    "domain": config.get("identityName", ""),
                }
            }
            res["aws_ses_domain_mail_from"] = {
                f"{logical_name}_mail_from": {
                    "domain": f"${{aws_ses_domain_identity.{logical_name}.domain}}",
                    "mail_from_domain": config.get("mailFromDomain", ""),
                }
            }
        else:
            res["aws_ses_email_identity"] = {
                logical_name: {
                    "email": config.get("identityName", ""),
                }
            }

        return {"resource": res}


# Auto-register handler when this module is imported.
registry.register(SESHandler())
