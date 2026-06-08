from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class ACMHandler(BaseAWSHandler):
    """
    Handler for AWS Certificate Manager (ACM) service.
    """

    @property
    def service_id(self) -> str:
        return "acm"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::CertificateManager::Certificate"

    @property
    def display_name(self) -> str:
        return "ACM Certificate"

    @property
    def resource_family(self) -> str:
        return "security"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate ACM Certificate configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        node_name = self._fallback_node_name(node)

        if not config.get("certificateName", "").strip():
            problems.append(
                f"ACM Certificate {node_name} is missing a certificate name."
            )
        if not config.get("domainName", "").strip():
            problems.append(f"ACM Certificate {node_name} is missing a domain name.")

        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build ACM planning details.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("certificateName", "ACM Certificate"),
            "connection_count": connection_count,
            "details": [
                {"label": "Domain Name", "value": config.get("domainName", "")},
                {
                    "label": "Validation Method",
                    "value": config.get("validationMethod", "DNS"),
                },
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for an ACM Certificate.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "acm"))
        return {
            "resource": {
                "aws_acm_certificate": {
                    logical_name: {
                        "domain_name": config.get("domainName", ""),
                        "validation_method": config.get("validationMethod", "DNS"),
                        "tags": {
                            "Name": config.get("certificateName", "acm-certificate"),
                        },
                    }
                }
            }
        }


# Auto-register handler when this module is imported.
registry.register(ACMHandler())
