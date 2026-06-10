import logging
from abc import abstractmethod

from cloud_services.base import BaseServiceHandler
from rest_framework import serializers

logger = logging.getLogger(__name__)


class GenericConfigSerializer(serializers.Serializer):
    """
    Pass-through serializer for supporting services configuration.
    """

    def to_internal_value(self, data):
        return data

    def to_representation(self, instance):
        return instance


class BaseAWSHandler(BaseServiceHandler):
    """
    AWS-specific base handler.

    Isolates all AWS-specific concerns from the provider-agnostic
    BaseServiceHandler. The cloud_formation_type property lives here,
    not in the abstract base, because it is AWS-specific.

    All AWS resource handlers should extend this class.
    """

    @property
    @abstractmethod
    def cloud_formation_type(self) -> str:
        """
        AWS CloudFormation resource type.
        Examples: 'AWS::Lambda::Function', 'AWS::EC2::VPC'.
        This property is AWS-specific and intentionally isolated here.
        """

    @property
    def provider_name(self) -> str:
        return "aws"

    def get_serializer_class(self):
        return GenericConfigSerializer

    @property
    def resource_family(self) -> str:
        """Default family. Handlers override to provide accurate grouping."""
        return "general"

    def _fallback_node_name(self, node):
        """
        Extract a readable name from config fields.
        """
        data = node.get("data", {})
        config = data.get("config", {})
        for name_field in [
            "vpc_name",
            "subnet_name",
            "group_name",
            "role_name",
            "repository_name",
            "creation_token",
            "layer_name",
            "api_name",
            "rule_name",
            "queue_name",
            "topic_name",
            "table_name",
            "bucket_name",
            "stream_name",
            "state_machine_name",
            "region_name",
            "zone_name",
            "env_name",
            "boundary_name",
            "services_name",
            "account_id",
        ]:
            if config.get(name_field):
                return config[name_field]
        return node.get("id", "unnamed")
