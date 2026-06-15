from django.db import models


class DeploymentStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    GENERATING = "generating", "Generating"
    INVOKING = "invoking", "Invoking"
    IN_PROGRESS = "in_progress", "In Progress"
    SUCCEEDED = "succeeded", "Succeeded"
    FAILED = "failed", "Failed"
