from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class AmazonMQHandler(BaseAWSHandler):
    """
    Handler for Amazon MQ broker service.
    """

    @property
    def service_id(self) -> str:
        return "amazon-mq"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::AmazonMQ::Broker"

    @property
    def display_name(self) -> str:
        return "Amazon MQ"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate Amazon MQ broker configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        if not config.get("broker_name"):
            problems.append(
                f"Amazon MQ broker {node.get('id', 'unnamed')} requires a broker name."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for an Amazon MQ broker.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("broker_name", "Broker"),
            "connection_count": connection_count,
            "details": [
                {"label": "Engine", "value": config.get("engine_type", "RABBITMQ")},
                {
                    "label": "Mode",
                    "value": config.get("deployment_mode", "SINGLE_INSTANCE"),
                },
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for an Amazon MQ broker.
        """
        config = node["data"]["config"]
        logical_name = self.sanitize_resource_name(node["id"])
        engine_type = config.get("engine_type", "RABBITMQ")

        engine_version = "3.11.20" if engine_type == "RABBITMQ" else "5.17.6"

        return {
            "resource": {
                "aws_mq_broker": {
                    logical_name: {
                        "broker_name": config.get("broker_name", "mq-broker"),
                        "engine_type": engine_type,
                        "engine_version": engine_version,
                        "host_instance_type": config.get(
                            "host_instance_type", "mq.t3.micro"
                        ),
                        "deployment_mode": config.get(
                            "deployment_mode", "SINGLE_INSTANCE"
                        ),
                        "user": [
                            {
                                "username": "admin",
                                "password": "CHANGE_ME",
                            }
                        ],
                    }
                }
            }
        }


registry.register(AmazonMQHandler())
