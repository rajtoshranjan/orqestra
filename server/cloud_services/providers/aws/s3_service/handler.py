from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class S3Handler(BaseAWSHandler):
    """
    Handler for AWS S3 Bucket service.
    """

    @property
    def service_id(self) -> str:
        return "s3"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::S3::Bucket"

    @property
    def display_name(self) -> str:
        return "Amazon S3"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate S3 Bucket configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        if not config.get("bucket_name"):
            problems.append(
                f"Bucket {self._fallback_node_name(node)} requires a bucket name."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for an S3 Bucket.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("bucket_name", "Bucket"),
            "connection_count": connection_count,
            "details": [
                {
                    "label": "Versioning",
                    "value": "On" if config.get("versioning") else "Off",
                },
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for an S3 Bucket, including trigger configurations.
        """
        config = node["data"]["config"]
        logical_name = self.sanitize_resource_name(node["id"])

        res = {
            "aws_s3_bucket": {
                logical_name: {"bucket": config.get("bucket_name", "bucket")}
            }
        }

        if config.get("versioning"):
            res["aws_s3_bucket_versioning"] = {
                f"{logical_name}_versioning": {
                    "bucket": f"${{aws_s3_bucket.{logical_name}.id}}",
                    "versioning_configuration": {"status": "Enabled"},
                }
            }

        # If S3 triggers Lambda, set up notifications and invoke permissions.
        for edge in edges or []:
            if edge.get("source") == node["id"] or edge.get("target") == node["id"]:
                connected_id = (
                    edge["source"] if edge["target"] == node["id"] else edge["target"]
                )
                for n in nodes or []:
                    # S3 -> Lambda trigger.
                    if (
                        edge.get("source") == node["id"]
                        and n["id"] == connected_id
                        and n.get("data", {}).get("service_id") == "lambda"
                    ):
                        lambda_logical = self.sanitize_resource_name(n["id"])

                        perm_logical = f"s3_perm_{logical_name}_{lambda_logical}"
                        if "aws_lambda_permission" not in res:
                            res["aws_lambda_permission"] = {}
                        res["aws_lambda_permission"][perm_logical] = {
                            "statement_id": f"AllowS3Invoke_{perm_logical}",
                            "action": "lambda:InvokeFunction",
                            "function_name": f"${{aws_lambda_function.{lambda_logical}.function_name}}",
                            "principal": "s3.amazonaws.com",
                            "source_arn": f"${{aws_s3_bucket.{logical_name}.arn}}",
                        }

                        notify_logical = f"s3_notify_{logical_name}_{lambda_logical}"
                        if "aws_s3_bucket_notification" not in res:
                            res["aws_s3_bucket_notification"] = {}
                        res["aws_s3_bucket_notification"][notify_logical] = {
                            "bucket": f"${{aws_s3_bucket.{logical_name}.id}}",
                            "lambda_function": [
                                {
                                    "lambda_function_arn": f"${{aws_lambda_function.{lambda_logical}.arn}}",
                                    "events": ["s3:ObjectCreated:*"],
                                }
                            ],
                            "depends_on": [f"aws_lambda_permission.{perm_logical}"],
                        }

        return {"resource": res}


registry.register(S3Handler())
