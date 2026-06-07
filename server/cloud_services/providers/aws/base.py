import logging

from rest_framework import serializers

from cloud_services.base import BaseServiceHandler

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
    Shared helper methods for AWS resource handlers.
    """

    def get_serializer_class(self):
        return GenericConfigSerializer

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
