from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class IAMRoleHandler(BaseAWSHandler):
    """
    Handler for AWS IAM Role service.
    """

    @property
    def service_id(self) -> str:
        return "iam-role"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::IAM::Role"

    @property
    def display_name(self) -> str:
        return "AWS IAM Role"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate IAM Role configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        if not config.get("role_name"):
            problems.append(
                f"IAM Role {self._fallback_node_name(node)} requires a role name."
            )
        if not config.get("assume_role_policy_document"):
            problems.append(
                f"IAM Role {self._fallback_node_name(node)} requires a trust relationship policy."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for an IAM Role.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("role_name", "IAM Role"),
            "connection_count": connection_count,
            "details": [
                {
                    "label": "Managed Policies",
                    "value": str(len(config.get("managed_policy_arns", []))),
                },
                {
                    "label": "Inline Policies",
                    "value": str(len(config.get("inline_policies", []))),
                },
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for an IAM Role.
        """
        config = node["data"]["config"]
        logical_name = self.sanitize_resource_name(node["id"])

        res = {
            "aws_iam_role": {
                logical_name: {
                    "name": config.get("role_name", "role"),
                    "description": config.get("description", "Managed by Orqestra"),
                    "assume_role_policy": config.get("assume_role_policy_document", ""),
                }
            }
        }

        # Policy attachments.
        for i, policy_arn in enumerate(config.get("managed_policy_arns", [])):
            attachment_name = f"{logical_name}_attachment_{i}"
            if "aws_iam_role_policy_attachment" not in res:
                res["aws_iam_role_policy_attachment"] = {}
            res["aws_iam_role_policy_attachment"][attachment_name] = {
                "role": f"${{aws_iam_role.{logical_name}.name}}",
                "policy_arn": policy_arn,
            }

        # Inline policies.
        for i, inline in enumerate(config.get("inline_policies", [])):
            policy_name = f"{logical_name}_policy_{i}"
            if "aws_iam_role_policy" not in res:
                res["aws_iam_role_policy"] = {}
            res["aws_iam_role_policy"][policy_name] = {
                "name": inline.get("name", "inline"),
                "role": f"${{aws_iam_role.{logical_name}.id}}",
                "policy": inline.get("document", ""),
            }

        return {"resource": res}


registry.register(IAMRoleHandler())
