from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class EventBridgeHandler(BaseAWSHandler):
    """
    Handler for AWS EventBridge service.
    """

    @property
    def service_id(self) -> str:
        return "eventbridge"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::Events::Rule"

    @property
    def display_name(self) -> str:
        return "Amazon EventBridge"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate EventBridge Rule configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        if not config.get("rule_name"):
            problems.append(
                f"EventBridge Rule {self._fallback_node_name(node)} requires a rule name."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for EventBridge.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("rule_name", "Rule"),
            "connection_count": connection_count,
            "details": [
                {
                    "label": "Schedule",
                    "value": config.get("schedule_expression", "Pattern-triggered"),
                },
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for an EventBridge Rule.
        """
        config = node["data"]["config"]
        logical_name = self.sanitize_resource_name(node["id"])

        rule = {
            "name": config.get("rule_name", "rule"),
            "description": "Managed by Orqestra",
        }

        if config.get("schedule_expression"):
            rule["schedule_expression"] = config["schedule_expression"]
        if config.get("event_pattern"):
            rule["event_pattern"] = config["event_pattern"]

        res = {"aws_cloudwatch_event_rule": {logical_name: rule}}

        # If connected as a trigger to Lambda, set up event target and permissions.
        for edge in edges or []:
            if edge.get("source") == node["id"] or edge.get("target") == node["id"]:
                connected_id = (
                    edge["source"] if edge["target"] == node["id"] else edge["target"]
                )
                for n in nodes or []:
                    # EventBridge -> Lambda trigger.
                    if (
                        edge.get("source") == node["id"]
                        and n["id"] == connected_id
                        and n.get("data", {}).get("service_id") == "lambda"
                    ):
                        lambda_logical = self.sanitize_resource_name(n["id"])
                        target_logical = f"target_{logical_name}_{lambda_logical}"

                        if "aws_cloudwatch_event_target" not in res:
                            res["aws_cloudwatch_event_target"] = {}
                        res["aws_cloudwatch_event_target"][target_logical] = {
                            "rule": f"${{aws_cloudwatch_event_rule.{logical_name}.name}}",
                            "arn": f"${{aws_lambda_function.{lambda_logical}.arn}}",
                        }

                        perm_logical = f"eb_perm_{logical_name}_{lambda_logical}"
                        if "aws_lambda_permission" not in res:
                            res["aws_lambda_permission"] = {}
                        res["aws_lambda_permission"][perm_logical] = {
                            "statement_id": f"AllowEventBridgeInvoke_{perm_logical}",
                            "action": "lambda:InvokeFunction",
                            "function_name": f"${{aws_lambda_function.{lambda_logical}.function_name}}",
                            "principal": "events.amazonaws.com",
                            "source_arn": f"${{aws_cloudwatch_event_rule.{logical_name}.arn}}",
                        }

        return {"resource": res}


registry.register(EventBridgeHandler())
