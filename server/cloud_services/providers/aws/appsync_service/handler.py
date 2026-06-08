from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class AppSyncHandler(BaseAWSHandler):
    """
    Handler for AWS AppSync GraphQL API service.
    """

    @property
    def service_id(self) -> str:
        return "appsync"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::AppSync::GraphQLApi"

    @property
    def display_name(self) -> str:
        return "AWS AppSync"

    @property
    def resource_family(self) -> str:
        return "integration"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate AppSync GraphQL API configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        node_name = self._fallback_node_name(node)

        if not config.get("apiName", "").strip():
            problems.append(f"AppSync API {node_name} is missing an API name.")

        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build AppSync planning details.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("apiName", "AppSync API"),
            "connection_count": connection_count,
            "details": [
                {
                    "label": "Authentication Type",
                    "value": config.get("authenticationType", "API_KEY"),
                },
                {"label": "API Type", "value": config.get("apiType", "GRAPHQL")},
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for AppSync GraphQL API.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "appsync"))
        return {
            "resource": {
                "aws_appsync_graphql_api": {
                    logical_name: {
                        "name": config.get("apiName", ""),
                        "authentication_type": config.get(
                            "authenticationType", "API_KEY"
                        ),
                        "tags": {
                            "Name": config.get("apiName", "appsync-api"),
                        },
                    }
                }
            }
        }


# Auto-register handler when this module is imported.
registry.register(AppSyncHandler())
