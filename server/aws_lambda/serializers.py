from rest_framework import serializers


class LambdaEnvironmentVariableSerializer(serializers.Serializer):
    id = serializers.CharField(required=False, allow_blank=True)
    key = serializers.CharField(required=False, allow_blank=True)
    value = serializers.CharField(required=False, allow_blank=True)


class LambdaConfigSerializer(serializers.Serializer):
    function_name = serializers.CharField(required=False, allow_blank=True, default="")
    runtime = serializers.CharField(required=False, allow_blank=True, default="")
    handler = serializers.CharField(required=False, allow_blank=True, default="")
    code = serializers.CharField(required=False, allow_blank=True, default="")
    environment_variables = LambdaEnvironmentVariableSerializer(
        many=True, required=False, default=list
    )
    memory_size = serializers.IntegerField(required=False, default=128)
    timeout = serializers.IntegerField(required=False, default=3)
    description = serializers.CharField(required=False, allow_blank=True, default="")
