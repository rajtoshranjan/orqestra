from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class CloudTrailHandler(BaseAWSHandler):
    """
    Handler for AWS CloudTrail service.
    """

    @property
    def service_id(self) -> str:
        return "cloudtrail"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::CloudTrail::Trail"

    @property
    def display_name(self) -> str:
        return "AWS CloudTrail"

    @property
    def resource_family(self) -> str:
        return "security"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate CloudTrail configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        node_name = self._fallback_node_name(node)

        if not config.get("trailName", "").strip():
            problems.append(f"CloudTrail {node_name} is missing a trail name.")
        if not config.get("destinationBucketName", "").strip():
            problems.append(
                f"CloudTrail {node_name} is missing a destination bucket name."
            )

        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build CloudTrail planning details.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("trailName", "CloudTrail"),
            "connection_count": connection_count,
            "details": [
                {
                    "label": "Destination Bucket",
                    "value": config.get("destinationBucketName", ""),
                },
                {
                    "label": "Management Events",
                    "value": config.get("managementEvents", "All"),
                },
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for CloudTrail.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "cloudtrail"))
        return {
            "resource": {
                "aws_cloudtrail": {
                    logical_name: {
                        "name": config.get("trailName", ""),
                        "s3_bucket_name": config.get("destinationBucketName", ""),
                        "include_global_service_events": True,
                        "tags": {
                            "Name": config.get("trailName", "cloudtrail-trail"),
                        },
                    }
                }
            }
        }


# Auto-register handler when this module is imported.
registry.register(CloudTrailHandler())
