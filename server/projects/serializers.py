from organisations.helpers import get_active_organisation
from rest_framework import serializers

from .models import Project


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = [
            "id",
            "organisation",
            "name",
            "description",
            "nodes",
            "edges",
            "deployment_settings",
            "aws_account",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "organisation", "created_at", "updated_at"]

    def validate(self, attrs):
        request = self.context.get("request")
        aws_account = attrs.get("aws_account")
        if aws_account:
            active_org = get_active_organisation(request)
            if aws_account.organisation != active_org:
                raise serializers.ValidationError(
                    {
                        "aws_account": "AWS account must belong to the active organisation."
                    }
                )
        return attrs


class ProjectListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for the project list — omits the full graph."""

    node_count = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            "id",
            "name",
            "description",
            "aws_account",
            "node_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_node_count(self, project):
        return len(project.nodes or [])
