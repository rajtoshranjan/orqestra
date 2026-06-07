from abc import ABC, abstractmethod


class BaseServiceHandler(ABC):
    """
    Abstract base class that all cloud service handlers must implement.
    Allows for dynamic discovery, validation, planning, and deployment.
    """

    @property
    @abstractmethod
    def service_id(self) -> str:
        """The unique identifier for the service (e.g. 'lambda', 's3', 'dynamodb')."""

    @property
    @abstractmethod
    def cloud_formation_type(self) -> str:
        """The AWS CloudFormation type (e.g. 'AWS::Lambda::Function')."""

    @property
    @abstractmethod
    def display_name(self) -> str:
        """User-friendly name (e.g. 'AWS Lambda')."""

    @abstractmethod
    def get_serializer_class(self):
        """Return the Django Rest Framework Serializer class for this service's config."""

    @abstractmethod
    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate the configuration of a node.
        Returns a list of error strings, or an empty list if valid.
        """

    @abstractmethod
    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build a plan resource details dictionary from a node and connection details.
        """

    @abstractmethod
    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate the OpenTofu resource configuration for this node.

        Returns a dict in Terraform JSON format, e.g.:
        {"resource": {"aws_lambda_function": {"<logical_name>": {<config>}}}}
        """

    def sanitize_resource_name(self, raw_name: str) -> str:
        """
        Convert a raw node ID or name into a valid Terraform resource name.
        Replaces hyphens and non-alphanumeric chars with underscores.
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
