from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class StepFunctionHandler(BaseAWSHandler):
    """
    Handler for AWS Step Functions service.
    """

    @property
    def service_id(self) -> str:
        return "step-function"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::StepFunctions::StateMachine"

    @property
    def display_name(self) -> str:
        return "AWS Step Functions"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate State Machine configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        if not config.get("state_machine_name"):
            problems.append(
                f"State Machine {self._fallback_node_name(node)} requires a name."
            )
        if not config.get("definition"):
            problems.append(
                f"State Machine {self._fallback_node_name(node)} requires an ASL definition."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for a Step Function State Machine.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("state_machine_name", "State Machine"),
            "connection_count": connection_count,
            "details": [
                {"label": "Type", "value": config.get("type", "STANDARD")},
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for a Step Function State Machine.
        """
        config = node["data"]["config"]
        logical_name = self.sanitize_resource_name(node["id"])

        return {
            "resource": {
                "aws_sfn_state_machine": {
                    logical_name: {
                        "name": config.get("state_machine_name", "sfn"),
                        "definition": config.get("definition", "{}"),
                        "role_arn": settings.get(
                            "execution_role_arn",
                            "arn:aws:iam::123456789012:role/SFNRole",
                        ),
                        "type": config.get("type", "STANDARD"),
                    }
                }
            }
        }


registry.register(StepFunctionHandler())
