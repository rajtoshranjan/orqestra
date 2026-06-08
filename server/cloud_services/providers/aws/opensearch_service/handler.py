from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class OpenSearchHandler(BaseAWSHandler):
    """
    Handler for Amazon OpenSearch Service Domain.
    """

    @property
    def service_id(self) -> str:
        return "opensearch"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::OpenSearchService::Domain"

    @property
    def display_name(self) -> str:
        return "Amazon OpenSearch"

    @property
    def resource_family(self) -> str:
        return "database"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate OpenSearch Domain configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        node_name = self._fallback_node_name(node)

        if not config.get("domainName", "").strip():
            problems.append(f"OpenSearch Domain {node_name} is missing a domain name.")
        if not config.get("engineVersion", "").strip():
            problems.append(
                f"OpenSearch Domain {node_name} is missing an engine version."
            )
        if not config.get("instanceType", "").strip():
            problems.append(
                f"OpenSearch Domain {node_name} is missing an instance type."
            )

        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build OpenSearch planning details.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("domainName", "OpenSearch Domain"),
            "connection_count": connection_count,
            "details": [
                {"label": "Engine Version", "value": config.get("engineVersion", "")},
                {"label": "Instance Type", "value": config.get("instanceType", "")},
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for OpenSearch Domain.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "opensearch"))
        return {
            "resource": {
                "aws_opensearch_domain": {
                    logical_name: {
                        "domain_name": config.get("domainName", ""),
                        "engine_version": config.get(
                            "engineVersion", "OpenSearch_2.11"
                        ),
                        "cluster_config": {
                            "instance_type": config.get(
                                "instanceType", "t3.small.search"
                            ),
                        },
                        "ebs_options": {
                            "ebs_enabled": True,
                            "volume_size": 10,
                        },
                        "tags": {
                            "Name": config.get("domainName", "opensearch-domain"),
                        },
                    }
                }
            }
        }


# Auto-register handler when this module is imported.
registry.register(OpenSearchHandler())
