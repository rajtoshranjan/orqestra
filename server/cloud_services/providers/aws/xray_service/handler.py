from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class XRayHandler(BaseAWSHandler):
    """
    Handler for AWS X-Ray Group service.
    """

    @property
    def service_id(self) -> str:
        return "xray"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::XRay::Group"

    @property
    def display_name(self) -> str:
        return "AWS X-Ray"

    @property
    def resource_family(self) -> str:
        return "monitoring"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate X-Ray Group configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        node_label = self._fallback_node_name(node)
        if not config.get("group_name"):
            problems.append(f"X-Ray Group {node_label} requires a group name.")
        sampling_rate = config.get("sampling_rate", 0)
        if not (1 <= int(sampling_rate) <= 100):
            problems.append(
                f"X-Ray Group {node_label} sampling rate must be between 1 and 100."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for an X-Ray Group.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("group_name", "X-Ray Group"),
            "connection_count": connection_count,
            "details": [
                {
                    "label": "Sampling Rate",
                    "value": f"{config.get('sampling_rate', 5)}%",
                },
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for an X-Ray Group.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "resource"))
        return {
            "resource": {
                "aws_xray_group": {
                    logical_name: {
                        "group_name": config.get("group_name", "xray-group"),
                        "filter_expression": 'service(id(name: "*"))',
                    }
                }
            }
        }


registry.register(XRayHandler())
