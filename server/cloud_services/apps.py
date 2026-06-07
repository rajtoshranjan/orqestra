from django.apps import AppConfig


class CloudServicesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "cloud_services"

    def ready(self):
        # Trigger AWS resource handler registration on startup by importing handlers.
        import cloud_services.providers.aws.account_service.handler  # noqa: F401
        import cloud_services.providers.aws.api_gateway_service.handler  # noqa: F401
        import cloud_services.providers.aws.app_group_service.handler  # noqa: F401
        import cloud_services.providers.aws.az_service.handler  # noqa: F401
        import cloud_services.providers.aws.dynamodb_service.handler  # noqa: F401
        import cloud_services.providers.aws.ecr_service.handler  # noqa: F401
        import cloud_services.providers.aws.efs_service.handler  # noqa: F401
        import cloud_services.providers.aws.environment_service.handler  # noqa: F401
        import cloud_services.providers.aws.eventbridge_service.handler  # noqa: F401
        import cloud_services.providers.aws.iam_role_service.handler  # noqa: F401
        import cloud_services.providers.aws.kinesis_service.handler  # noqa: F401
        import cloud_services.providers.aws.lambda_layer_service.handler  # noqa: F401
        import cloud_services.providers.aws.lambda_service.handler  # noqa: F401
        import cloud_services.providers.aws.region_service.handler  # noqa: F401
        import cloud_services.providers.aws.s3_service.handler  # noqa: F401
        import cloud_services.providers.aws.security_group_service.handler  # noqa: F401
        import cloud_services.providers.aws.shared_services_service.handler  # noqa: F401
        import cloud_services.providers.aws.sns_service.handler  # noqa: F401
        import cloud_services.providers.aws.sqs_service.handler  # noqa: F401
        import cloud_services.providers.aws.step_function_service.handler  # noqa: F401
        import cloud_services.providers.aws.subnet_service.handler  # noqa: F401
        import cloud_services.providers.aws.trust_boundary_service.handler  # noqa: F401
        import cloud_services.providers.aws.vpc_service.handler  # noqa: F401
