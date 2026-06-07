from rest_framework import serializers


class DiagramNodeSerializer(serializers.Serializer):
    id = serializers.CharField()
    type = serializers.CharField(required=False, allow_blank=True, default="")
    parentNode = serializers.CharField(
        required=False, allow_null=True, allow_blank=True, default=None
    )
    parent_node = serializers.CharField(
        required=False, allow_null=True, allow_blank=True, default=None
    )
    data = serializers.DictField()


class DiagramEdgeSerializer(serializers.Serializer):
    id = serializers.CharField()
    source = serializers.CharField()
    target = serializers.CharField()


class DeploymentSettingsSerializer(serializers.Serializer):
    region = serializers.CharField(required=False, allow_blank=True, default="")
    execution_role_arn = serializers.CharField(
        required=False, allow_blank=True, default=""
    )


class DiagramSerializer(serializers.Serializer):
    nodes = DiagramNodeSerializer(many=True, required=False, default=list)
    edges = DiagramEdgeSerializer(many=True, required=False, default=list)
    deployment_settings = DeploymentSettingsSerializer(required=False)
    last_saved_at = serializers.CharField(required=False, allow_blank=True, default="")


class RequestPayloadSerializer(serializers.Serializer):
    diagram = DiagramSerializer()


# --- Output Serializers ---


class PlanResourceSerializer(serializers.Serializer):
    id = serializers.CharField()
    type = serializers.CharField()
    name = serializers.CharField()
    runtime = serializers.CharField()
    memory_size = serializers.IntegerField()
    timeout = serializers.IntegerField()
    environment_variable_count = serializers.IntegerField()
    connection_count = serializers.IntegerField()


class DeploymentLogSerializer(serializers.Serializer):
    level = serializers.CharField()
    message = serializers.CharField()
