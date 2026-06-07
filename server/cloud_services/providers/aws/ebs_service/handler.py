from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class EBSHandler(BaseAWSHandler):
    """
    Handler for Amazon EBS Volume service.
    """

    @property
    def service_id(self) -> str:
        return "ebs"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::EC2::Volume"

    @property
    def display_name(self) -> str:
        return "Amazon EBS"

    @property
    def resource_family(self) -> str:
        return "storage"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate EBS Volume configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        node_label = self._fallback_node_name(node)
        if not config.get("volume_name"):
            problems.append(f"EBS Volume {node_label} requires a volume name.")
        size_gb = config.get("size_gb", 0)
        if int(size_gb) < 1:
            problems.append(
                f"EBS Volume {node_label} requires a size of at least 1 GiB."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for an EBS Volume.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("volume_name", "EBS Volume"),
            "connection_count": connection_count,
            "details": [
                {"label": "Type", "value": config.get("volume_type", "gp3")},
                {"label": "Size", "value": f"{config.get('size_gb', 20)} GiB"},
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for an EBS Volume.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "resource"))
        return {
            "resource": {
                "aws_ebs_volume": {
                    logical_name: {
                        "availability_zone": "us-east-1a",
                        "size": config.get("size_gb", 20),
                        "type": config.get("volume_type", "gp3"),
                        "encrypted": config.get("encrypted", True),
                        "tags": {
                            "Name": config.get("volume_name", "ebs-volume"),
                        },
                    }
                }
            }
        }


registry.register(EBSHandler())
