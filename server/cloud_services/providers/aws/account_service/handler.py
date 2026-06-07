from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class AccountHandler(BaseAWSHandler):
    """
    Handler for AWS Account container/meta service.
    """

    @property
    def service_id(self) -> str:
        return "account"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::Account"

    @property
    def display_name(self) -> str:
        return "AWS Account"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate Account configuration, checking for a 12-digit ID.
        """
        import re

        problems = []
        config = node.get("data", {}).get("config", {})
        account_id = config.get("account_id", "")
        if not account_id:
            problems.append(
                f"AWS Account {self._fallback_node_name(node)} requires an account ID."
            )
        elif not re.match(r"^\d{12}$", str(account_id)):
            problems.append(
                f"AWS Account {self._fallback_node_name(node)} account ID must be a 12-digit AWS account ID."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for an AWS Account.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("account_id", "Account"),
            "connection_count": connection_count,
            "details": [
                {"label": "Account ID", "value": config.get("account_id", "")},
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for an AWS Account (no resources created directly).
        """
        return {"resource": {}}


registry.register(AccountHandler())
