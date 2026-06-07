from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class DynamoDBHandler(BaseAWSHandler):
    """
    Handler for AWS DynamoDB Table service.
    """

    @property
    def service_id(self) -> str:
        return "dynamodb"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::DynamoDB::Table"

    @property
    def display_name(self) -> str:
        return "Amazon DynamoDB"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate DynamoDB Table configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        if not config.get("table_name"):
            problems.append(
                f"Table {self._fallback_node_name(node)} requires a table name."
            )
        if not config.get("hash_key"):
            problems.append(
                f"Table {self._fallback_node_name(node)} requires a partition key."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for a DynamoDB Table.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("table_name", "Table"),
            "connection_count": connection_count,
            "details": [
                {"label": "Partition Key", "value": config.get("hash_key", "")},
                {
                    "label": "Billing",
                    "value": config.get("billing_mode", "PAY_PER_REQUEST"),
                },
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for a DynamoDB Table.
        """
        config = node["data"]["config"]
        logical_name = self.sanitize_resource_name(node["id"])

        attributes = [
            {"name": config["hash_key"], "type": config.get("hash_key_type", "S")}
        ]
        if config.get("range_key"):
            attributes.append(
                {"name": config["range_key"], "type": config.get("range_key_type", "S")}
            )

        table_config = {
            "name": config.get("table_name", "table"),
            "billing_mode": config.get("billing_mode", "PAY_PER_REQUEST"),
            "hash_key": config["hash_key"],
            "attribute": attributes,
        }

        if config.get("range_key"):
            table_config["range_key"] = config["range_key"]

        if config.get("stream_enabled"):
            table_config["stream_enabled"] = True
            table_config["stream_view_type"] = config.get(
                "stream_view_type", "NEW_AND_OLD_IMAGES"
            )

        res = {"aws_dynamodb_table": {logical_name: table_config}}

        # If stream is enabled and connected to Lambda, map stream to trigger Lambda.
        if config.get("stream_enabled"):
            for edge in edges or []:
                if edge.get("source") == node["id"] or edge.get("target") == node["id"]:
                    connected_id = (
                        edge["source"]
                        if edge["target"] == node["id"]
                        else edge["target"]
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
                                "event_source_arn": f"${{aws_dynamodb_table.{logical_name}.stream_arn}}",
                                "function_name": f"${{aws_lambda_function.{lambda_logical}.arn}}",
                                "starting_position": "LATEST",
                            }

        return {"resource": res}


registry.register(DynamoDBHandler())
