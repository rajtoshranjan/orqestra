from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class GuardDutyHandler(BaseAWSHandler):
    """
    Handler for Amazon GuardDuty Detector service.
    """

    @property
    def service_id(self) -> str:
        return "guardduty"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::GuardDuty::Detector"

    @property
    def display_name(self) -> str:
        return "Amazon GuardDuty"

    @property
    def resource_family(self) -> str:
        return "security"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate GuardDuty configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        node_name = self._fallback_node_name(node)

        if not config.get("detectorName", "").strip():
            problems.append(
                f"GuardDuty Detector {node_name} is missing a detector name."
            )

        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build GuardDuty planning details.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("detectorName", "GuardDuty Detector"),
            "connection_count": connection_count,
            "details": [
                {
                    "label": "Finding Publishing Frequency",
                    "value": config.get("findingPublishingFrequency", "SIX_HOURS"),
                },
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for GuardDuty Detector.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "guardduty"))
        return {
            "resource": {
                "aws_guardduty_detector": {
                    logical_name: {
                        "enable": True,
                        "finding_publishing_frequency": config.get(
                            "findingPublishingFrequency", "SIX_HOURS"
                        ),
                        "tags": {
                            "Name": config.get("detectorName", "guardduty-detector"),
                        },
                    }
                }
            }
        }


# Auto-register handler when this module is imported.
registry.register(GuardDutyHandler())
