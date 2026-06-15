from django.db import models

from .constants import DeploymentStatus


class DeploymentQuerySet(models.QuerySet):
    """Custom queryset for deployment filtering."""

    def for_project(self, project_id):
        """Filter deployments by project ID."""
        return self.filter(project_id=project_id)

    def active(self):
        """Filter deployments that are still running."""
        return self.filter(
            status__in=[
                DeploymentStatus.PENDING,
                DeploymentStatus.GENERATING,
                DeploymentStatus.INVOKING,
                DeploymentStatus.IN_PROGRESS,
            ]
        )

    def completed(self):
        """Filter deployments that have finished (success or failure)."""
        return self.filter(
            status__in=[DeploymentStatus.SUCCEEDED, DeploymentStatus.FAILED]
        )


class DeploymentManager(models.Manager):
    """Manager for Deployment model."""

    def get_queryset(self):
        return DeploymentQuerySet(self.model, using=self._db)

    def for_project(self, project_id):
        return self.get_queryset().for_project(project_id)

    def active(self):
        return self.get_queryset().active()

    def completed(self):
        return self.get_queryset().completed()
