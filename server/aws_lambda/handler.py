from cloud_services.base import BaseServiceHandler
from cloud_services.registry import registry
from .serializers import LambdaConfigSerializer
from .services import deploy_lambda, ensure_command, normalize_environment_variables


class LambdaHandler(BaseServiceHandler):
    """
    Handler for AWS Lambda function service.
    """

    @property
    def service_id(self) -> str:
        return "lambda"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::Lambda::Function"

    @property
    def display_name(self) -> str:
        return "AWS Lambda"

    def get_serializer_class(self):
        return LambdaConfigSerializer

    def validate(self, node: dict) -> list[str]:
        """
        Validate Lambda configuration.
        """
        problems = []
        data = node.get("data", {})
        config = data.get("config", {})
        node_name = self._fallback_node_name(node)

        if not config.get("function_name", "").strip():
            problems.append(f"Node {node_name} is missing a function name.")

        if not config.get("runtime", "").strip():
            problems.append(f"Lambda {node_name} is missing a runtime.")

        if not config.get("handler", "").strip():
            problems.append(f"Lambda {node_name} is missing a handler.")

        if not config.get("code", "").strip():
            problems.append(f"Lambda {node_name} is missing inline code.")

        memory_size = config.get("memory_size", 0)
        if memory_size < 128 or memory_size > 10240:
            problems.append(f"Lambda {node_name} has an invalid memory size.")

        timeout = config.get("timeout", 0)
        if timeout < 1 or timeout > 900:
            problems.append(f"Lambda {node_name} has an invalid timeout.")

        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build Lambda plan details.
        """
        data = node.get("data", {})
        config = data.get("config", {})
        env_vars = normalize_environment_variables(
            config.get("environment_variables", [])
        )

        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("function_name", ""),
            "runtime": config.get("runtime", ""),
            "memory_size": config.get("memory_size", 128),
            "timeout": config.get("timeout", 3),
            "environment_variable_count": len(env_vars),
            "connection_count": connection_count,
        }

    def deploy(self, node: dict, settings: dict, logs: list) -> None:
        """
        Ensure required tools are present, then deploy Lambda.
        """
        # Ensure required CLI tools are available.
        ensure_command("aws")
        ensure_command("zip")

        deploy_lambda(node, settings, logs)

    def _fallback_node_name(self, node):
        """Return the best available name for a node."""
        data = node.get("data", {})
        name = data.get("config", {}).get("function_name", "").strip()
        if name:
            return name
        node_id = node.get("id", "").strip()
        if node_id:
            return node_id
        return "unknown"


# Auto-register handler when this module is imported
registry.register(LambdaHandler())
