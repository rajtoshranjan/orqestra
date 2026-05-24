from django.apps import AppConfig


class AwsLambdaConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "aws_lambda"

    def ready(self):
        # Trigger handler registration on startup by importing handler
        import aws_lambda.handler  # noqa: F401
