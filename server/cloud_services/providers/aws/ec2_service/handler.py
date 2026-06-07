from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class EC2Handler(BaseAWSHandler):
    """
    Handler for AWS EC2 Instance service.
    """

    @property
    def service_id(self) -> str:
        return "ec2"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::EC2::Instance"

    @property
    def display_name(self) -> str:
        return "Amazon EC2"

    @property
    def resource_family(self) -> str:
        return "compute"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate EC2 Instance configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        node_label = self._fallback_node_name(node)
        if not config.get("instance_name"):
            problems.append(f"EC2 Instance {node_label} requires an instance name.")
        if not config.get("instance_type"):
            problems.append(f"EC2 Instance {node_label} requires an instance type.")
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for an EC2 Instance.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("instance_name", "EC2 Instance"),
            "connection_count": connection_count,
            "details": [
                {"label": "Instance Type", "value": config.get("instance_type", "")},
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for an EC2 Instance.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "resource"))
        return {
            "resource": {
                "aws_instance": {
                    logical_name: {
                        "ami": config.get("ami", "ami-0c55b159cbfafe1f0"),
                        "instance_type": config.get("instance_type", "t3.micro"),
                        "tags": {"Name": config.get("instance_name", "ec2-instance")},
                    }
                }
            }
        }


registry.register(EC2Handler())
