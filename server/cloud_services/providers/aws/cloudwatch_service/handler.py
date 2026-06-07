from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class CloudWatchHandler(BaseAWSHandler):
    """
    Handler for Amazon CloudWatch Dashboard service.
    """

    @property
    def service_id(self) -> str:
        return "cloudwatch"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::CloudWatch::Dashboard"

    @property
    def display_name(self) -> str:
        return "Amazon CloudWatch"

    @property
    def resource_family(self) -> str:
        return "monitoring"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate CloudWatch Dashboard configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        if not config.get("dashboard_name"):
            problems.append(
                f"CloudWatch {self._fallback_node_name(node)} requires a dashboard name."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for a CloudWatch Dashboard.
        """
        config = node.get("data", {}).get("config", {})
        retention_days = config.get("retention_days", 0)
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("dashboard_name", "CloudWatch Dashboard"),
            "connection_count": connection_count,
            "details": [
                {
                    "label": "Log Retention",
                    "value": f"{retention_days} days"
                    if retention_days
                    else "Never expire",
                },
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for a CloudWatch Dashboard.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "resource"))
        return {
            "resource": {
                "aws_cloudwatch_dashboard": {
                    logical_name: {
                        "dashboard_name": config.get("dashboard_name", "dashboard"),
                        "dashboard_body": "{}",
                    }
                }
            }
        }


registry.register(CloudWatchHandler())
