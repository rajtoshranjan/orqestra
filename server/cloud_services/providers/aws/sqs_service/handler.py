from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class SQSHandler(BaseAWSHandler):
    """
    Handler for AWS SQS Queue service.
    """

    @property
    def service_id(self) -> str:
        return "sqs"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::SQS::Queue"

    @property
    def display_name(self) -> str:
        return "Amazon SQS"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate SQS Queue configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        if not config.get("queue_name"):
            problems.append(
                f"Queue {self._fallback_node_name(node)} requires a queue name."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for an SQS Queue.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("queue_name", "Queue"),
            "connection_count": connection_count,
            "details": [
                {"label": "FIFO", "value": "Yes" if config.get("fifo_queue") else "No"},
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for an SQS Queue.
        """
        config = node["data"]["config"]
        logical_name = self.sanitize_resource_name(node["id"])

        res = {
            "aws_sqs_queue": {
                logical_name: {
                    "name": config.get("queue_name", "queue"),
                    "fifo_queue": config.get("fifo_queue", False),
                    "visibility_timeout_seconds": config.get(
                        "visibility_timeout_seconds", 30
                    ),
                    "message_retention_seconds": config.get(
                        "message_retention_seconds", 345600
                    ),
                    "delay_seconds": config.get("delay_seconds", 0),
                }
            }
        }

        # If connected as a trigger to lambda, create event source mapping.
        for edge in edges or []:
            if edge.get("source") == node["id"] or edge.get("target") == node["id"]:
                connected_id = (
                    edge["source"] if edge["target"] == node["id"] else edge["target"]
                )
                for n in nodes or []:
                    # Edge goes SQS -> Lambda (source=SQS, target=Lambda).
                    if (
                        edge.get("source") == node["id"]
                        and n["id"] == connected_id
                        and n.get("data", {}).get("service_id") == "lambda"
                    ):
                        lambda_logical = self.sanitize_resource_name(n["id"])
                        mapping_logical = f"mapping_{logical_name}_{lambda_logical}"
                        if "aws_lambda_event_source_mapping" not in res:
                            res["aws_lambda_event_source_mapping"] = {}
                        res["aws_lambda_event_source_mapping"][mapping_logical] = {
                            "event_source_arn": f"${{aws_sqs_queue.{logical_name}.arn}}",
                            "function_name": f"${{aws_lambda_function.{lambda_logical}.arn}}",
                            "batch_size": 10,
                        }

        return {"resource": res}


registry.register(SQSHandler())
