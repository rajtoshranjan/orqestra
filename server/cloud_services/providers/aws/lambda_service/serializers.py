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
    package_type = serializers.CharField(required=False, default="Zip")
    architecture = serializers.CharField(required=False, default="x86_64")

    # Container settings
    image_uri = serializers.CharField(required=False, allow_blank=True, default="")
    image_tag = serializers.CharField(required=False, allow_blank=True, default="")
    image_digest = serializers.CharField(required=False, allow_blank=True, default="")

    # Concurrency & SnapStart
    reserved_concurrency = serializers.IntegerField(required=False, allow_null=True)
    provisioned_concurrency = serializers.IntegerField(required=False, allow_null=True)
    snap_start = serializers.CharField(required=False, default="None")
    ephemeral_storage = serializers.IntegerField(required=False, default=512)

    # Function URL settings
    enable_function_url = serializers.BooleanField(required=False, default=False)
    function_url_auth_type = serializers.CharField(required=False, default="NONE")

    # Monitoring
    log_retention = serializers.IntegerField(required=False, default=14)
    tracing_mode = serializers.CharField(required=False, default="PassThrough")
    lambda_insights = serializers.BooleanField(required=False, default=False)
