from django.apps import AppConfig


class CloudServicesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "cloud_services"

    def ready(self):
        # Trigger AWS Lambda registration on startup by importing its handler
        import cloud_services.providers.aws.lambda_service.handler  # noqa: F401
