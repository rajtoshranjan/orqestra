from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class KinesisHandler(BaseAWSHandler):
    """
    Handler for AWS Kinesis Stream service.
    """

    @property
    def service_id(self) -> str:
        return "kinesis"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::Kinesis::Stream"

    @property
    def display_name(self) -> str:
        return "Amazon Kinesis"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate Kinesis Stream configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        if not config.get("stream_name"):
            problems.append(
                f"Stream {self._fallback_node_name(node)} requires a stream name."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for Kinesis.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("stream_name", "Kinesis"),
            "connection_count": connection_count,
            "details": [
                {"label": "Shards", "value": str(config.get("shard_count", 1))},
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for a Kinesis Stream, mapping trigger configurations to Lambdas.
        """
        config = node["data"]["config"]
        logical_name = self.sanitize_resource_name(node["id"])

        res = {
            "aws_kinesis_stream": {
                logical_name: {
                    "name": config.get("stream_name", "stream"),
                    "shard_count": config.get("shard_count", 1),
                    "retention_period": config.get("retention_period", 24),
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
                            "event_source_arn": f"${{aws_kinesis_stream.{logical_name}.arn}}",
                            "function_name": f"${{aws_lambda_function.{lambda_logical}.arn}}",
                            "starting_position": "LATEST",
                        }

        return {"resource": res}


registry.register(KinesisHandler())
