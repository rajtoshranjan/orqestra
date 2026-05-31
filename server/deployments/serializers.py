from rest_framework import serializers

from .models import DeployedResource, Deployment, ProjectDeploymentState


class DeploymentLogSerializer(serializers.Serializer):
    level = serializers.CharField()
    message = serializers.CharField()
    timestamp = serializers.CharField(required=False, default="")


class DeployedResourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeployedResource
        fields = [
            "id",
            "node_id",
            "service_id",
            "resource_identifier",
            "status",
            "created_at",
        ]
        read_only_fields = fields


class DeploymentSerializer(serializers.ModelSerializer):
    """Read-only serializer for deployment status and logs."""

    logs = DeploymentLogSerializer(many=True, read_only=True)

    class Meta:
        model = Deployment
        fields = [
            "id",
            "project",
            "status",
            "logs",
            "error_message",
            "tofu_plan_output",
            "started_at",
            "completed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class DeploymentCreateSerializer(serializers.Serializer):
    """Accepts a project_id to trigger a new deployment."""

    project_id = serializers.UUIDField()


class DeploymentCallbackSerializer(serializers.Serializer):
    """Accepts results from the deployer service."""

    status = serializers.ChoiceField(choices=["succeeded", "failed"])
    logs = DeploymentLogSerializer(many=True, required=False, default=list)
    tofu_state = serializers.JSONField(required=False, allow_null=True, default=None)
    plan_output = serializers.CharField(required=False, default="", allow_blank=True)
    error_message = serializers.CharField(required=False, default="", allow_blank=True)
    outputs = serializers.DictField(required=False, default=dict)


class ProjectDeploymentStateSerializer(serializers.ModelSerializer):
    """Read-only serializer for the current deployment state of a project."""

    last_deployment = DeploymentSerializer(read_only=True)
    resources = DeployedResourceSerializer(many=True, read_only=True)

    class Meta:
        model = ProjectDeploymentState
        fields = [
            "id",
            "project",
            "last_deployment",
            "deployed_graph_hash",
            "last_deployed_at",
            "resources",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields
