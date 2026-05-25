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
        pass

    @property
    @abstractmethod
    def cloud_formation_type(self) -> str:
        """The AWS CloudFormation type (e.g. 'AWS::Lambda::Function')."""
        pass

    @property
    @abstractmethod
    def display_name(self) -> str:
        """User-friendly name (e.g. 'AWS Lambda')."""
        pass

    @abstractmethod
    def get_serializer_class(self):
        """Return the Django Rest Framework Serializer class for this service's config."""
        pass

    @abstractmethod
    def validate(self, node: dict) -> list[str]:
        """
        Validate the configuration of a node.
        Returns a list of error strings, or an empty list if valid.
        """
        pass

    @abstractmethod
    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build a plan resource details dictionary from a node and connection details.
        """
        pass

    @abstractmethod
    def deploy(self, node: dict, settings: dict, logs: list) -> None:
        """
        Deploy the resource described by the node.
        Appends log dictionaries to the logs list.
        """
        pass
