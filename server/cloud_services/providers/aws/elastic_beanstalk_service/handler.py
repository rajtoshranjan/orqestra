from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class ElasticBeanstalkHandler(BaseAWSHandler):
    """
    Handler for AWS Elastic Beanstalk service.
    """

    @property
    def service_id(self) -> str:
        return "elastic-beanstalk"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::ElasticBeanstalk::Application"

    @property
    def display_name(self) -> str:
        return "AWS Elastic Beanstalk"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate Elastic Beanstalk application configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        if not config.get("application_name"):
            problems.append(
                f"Elastic Beanstalk application {node.get('id', 'unnamed')} requires an application name."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for an Elastic Beanstalk application.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("application_name", "Application"),
            "connection_count": connection_count,
            "details": [
                {"label": "Platform", "value": config.get("platform", "Node.js 20")},
                {"label": "Tier", "value": config.get("environment_tier", "WebServer")},
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for an Elastic Beanstalk application.
        """
        config = node["data"]["config"]
        logical_name = self.sanitize_resource_name(node["id"])

        return {
            "resource": {
                "aws_elastic_beanstalk_application": {
                    logical_name: {
                        "name": config.get("application_name", "beanstalk-app"),
                    }
                }
            }
        }


registry.register(ElasticBeanstalkHandler())
