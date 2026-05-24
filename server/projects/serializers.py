from rest_framework import serializers
from .models import Project


class ProjectSerializer(serializers.ModelSerializer):
    """
    Project model serializer utilizing native snake_case field mappings.
    """

    class Meta:
        model = Project
        fields = [
            "id",
            "name",
            "description",
            "nodes",
            "edges",
            "deployment_settings",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
