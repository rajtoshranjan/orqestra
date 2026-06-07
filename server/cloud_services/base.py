from abc import ABC, abstractmethod


class BaseServiceHandler(ABC):
    """
    Provider-agnostic abstract base for all cloud service handlers.

    Every cloud resource — regardless of provider (AWS, Azure, GCP, Kubernetes)
    — must implement this interface. Provider-specific properties and helpers
    belong in provider-level base classes (e.g. BaseAWSHandler), not here.

    The orchestration layer (deployments, validation, planning) only depends
    on this interface, ensuring it remains provider-agnostic.
    """

    @property
    @abstractmethod
    def service_id(self) -> str:
        """
        Unique service identifier that matches the frontend service registry.
        Examples: 'lambda', 's3', 'dynamodb', 'ec2'.
        """

    @property
    @abstractmethod
    def display_name(self) -> str:
        """User-facing display name. Examples: 'AWS Lambda', 'Amazon S3'."""

    @property
    def provider_name(self) -> str:
        """
        Cloud provider identifier. Defaults to 'aws'.
        Override in provider-level base classes (e.g. 'azure', 'gcp', 'kubernetes').
        """
        return "aws"

    @property
    def resource_family(self) -> str:
        """
        Broad resource family for grouping and analytics.
        Examples: 'compute', 'storage', 'networking', 'database', 'security',
                  'integration', 'monitoring'.
        Override per handler. Defaults to 'general'.
        """
        return "general"

    @abstractmethod
    def get_serializer_class(self):  # type: ignore[return]
        """Return the DRF Serializer class for this service's config payload."""

    @abstractmethod
    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate the configuration of a graph node.

        Returns a list of error strings describing any problems found.
        Returns an empty list if the configuration is valid.

        Args:
            node: The graph node dict containing 'id', 'data.config', etc.
            nodes: All nodes in the graph (for relationship validation).
            edges: All edges in the graph (for relationship validation).
        """

    @abstractmethod
    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build a deployment plan resource descriptor from a node.

        Returns a dict describing what this node will deploy, used to
        build the human-readable deployment preview.
        """

    @abstractmethod
    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate the OpenTofu (Terraform) resource configuration for this node.

        Returns a dict in Terraform JSON format:
            {"resource": {"aws_lambda_function": {"<logical_name>": {<config>}}}}

        Logical-only resources (regions, environments, groups) should return
        an empty dict rather than raise an exception.

        Args:
            node: The graph node dict.
            settings: Deployment settings (region, credentials, etc.).
            nodes: All nodes in the graph.
            edges: All edges in the graph.
        """

    def sanitize_resource_name(self, raw_name: str) -> str:
        """
        Convert a raw node ID or label into a valid Terraform resource name.

        Replaces all non-alphanumeric characters (except underscores) with
        underscores, and ensures the name does not start with a digit.
        """
        sanitized = ""
        for char in raw_name:
            if char.isalnum() or char == "_":
                sanitized += char
            else:
                sanitized += "_"
        if sanitized and sanitized[0].isdigit():
            sanitized = f"n_{sanitized}"
        return sanitized or "unnamed"
