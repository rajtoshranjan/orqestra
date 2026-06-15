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
    """Lightweight read serializer for deployment status and logs.

    Deliberately excludes the heavy ``graph_snapshot`` and the unused
    ``tofu_plan_output`` so the polled status endpoint stays small.
    """

    logs = DeploymentLogSerializer(many=True, read_only=True)

    class Meta:
        model = Deployment
        fields = [
            "id",
            "project",
            "status",
            "logs",
            "error_message",
            "started_at",
            "completed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class DeploymentWithGraphSerializer(DeploymentSerializer):
    """Adds the graph snapshot — used where the canvas overlay needs it."""

    class Meta(DeploymentSerializer.Meta):
        fields = DeploymentSerializer.Meta.fields + ["graph_snapshot"]
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

    last_deployment = DeploymentWithGraphSerializer(read_only=True)
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
