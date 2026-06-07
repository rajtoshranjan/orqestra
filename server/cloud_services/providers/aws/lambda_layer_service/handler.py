from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class LambdaLayerHandler(BaseAWSHandler):
    """
    Handler for AWS Lambda Layer service.
    """

    @property
    def service_id(self) -> str:
        return "lambda-layer"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::Lambda::LayerVersion"

    @property
    def display_name(self) -> str:
        return "AWS Lambda Layer"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate Lambda Layer configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        if not config.get("layer_name"):
            problems.append(
                f"Layer {self._fallback_node_name(node)} requires a layer name."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for a Lambda Layer.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("layer_name", "Layer"),
            "connection_count": connection_count,
            "details": [
                {
                    "label": "Runtimes",
                    "value": str(len(config.get("compatible_runtimes", []))),
                },
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for a Lambda Layer.
        """
        config = node["data"]["config"]
        logical_name = self.sanitize_resource_name(node["id"])

        return {
            "resource": {
                "aws_lambda_layer_version": {
                    logical_name: {
                        "layer_name": config.get("layer_name", "layer"),
                        "compatible_runtimes": config.get(
                            "compatible_runtimes", ["nodejs20.x"]
                        ),
                        "compatible_architectures": config.get(
                            "compatible_architectures", ["x86_64"]
                        ),
                        "filename": f"bundles/{logical_name}_layer.zip",
                    }
                }
            }
        }


registry.register(LambdaLayerHandler())
