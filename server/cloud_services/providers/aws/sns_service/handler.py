from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class SNSHandler(BaseAWSHandler):
    """
    Handler for AWS SNS Topic service.
    """

    @property
    def service_id(self) -> str:
        return "sns"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::SNS::Topic"

    @property
    def display_name(self) -> str:
        return "Amazon SNS"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate SNS Topic configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        if not config.get("topic_name"):
            problems.append(
                f"SNS Topic {self._fallback_node_name(node)} requires a topic name."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for an SNS Topic.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("topic_name", "Topic"),
            "connection_count": connection_count,
            "details": [
                {"label": "FIFO", "value": "Yes" if config.get("fifo_topic") else "No"},
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for an SNS Topic.
        """
        config = node["data"]["config"]
        logical_name = self.sanitize_resource_name(node["id"])

        res = {
            "aws_sns_topic": {
                logical_name: {
                    "name": config.get("topic_name", "topic"),
                    "fifo_topic": config.get("fifo_topic", False),
                }
            }
        }

        # If connected to a Lambda, create topic subscription and trigger permissions.
        for edge in edges or []:
            if edge.get("source") == node["id"] or edge.get("target") == node["id"]:
                connected_id = (
                    edge["source"] if edge["target"] == node["id"] else edge["target"]
                )
                for n in nodes or []:
                    # SNS -> Lambda trigger.
                    if (
                        edge.get("source") == node["id"]
                        and n["id"] == connected_id
                        and n.get("data", {}).get("service_id") == "lambda"
                    ):
                        lambda_logical = self.sanitize_resource_name(n["id"])
                        sub_logical = f"sub_{logical_name}_{lambda_logical}"
                        if "aws_sns_topic_subscription" not in res:
                            res["aws_sns_topic_subscription"] = {}
                        res["aws_sns_topic_subscription"][sub_logical] = {
                            "topic_arn": f"${{aws_sns_topic.{logical_name}.arn}}",
                            "protocol": "lambda",
                            "endpoint": f"${{aws_lambda_function.{lambda_logical}.arn}}",
                        }

                        perm_logical = f"sns_perm_{logical_name}_{lambda_logical}"
                        if "aws_lambda_permission" not in res:
                            res["aws_lambda_permission"] = {}
                        res["aws_lambda_permission"][perm_logical] = {
                            "statement_id": f"AllowSNSInvoke_{perm_logical}",
                            "action": "lambda:InvokeFunction",
                            "function_name": f"${{aws_lambda_function.{lambda_logical}.function_name}}",
                            "principal": "sns.amazonaws.com",
                            "source_arn": f"${{aws_sns_topic.{logical_name}.arn}}",
                        }

        return {"resource": res}


registry.register(SNSHandler())
