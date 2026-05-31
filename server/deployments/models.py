from django.db import models
from orqestra.models import BaseModel

from .managers import DeploymentManager


class DeploymentStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    GENERATING = "generating", "Generating"
    INVOKING = "invoking", "Invoking"
    IN_PROGRESS = "in_progress", "In Progress"
    SUCCEEDED = "succeeded", "Succeeded"
    FAILED = "failed", "Failed"


class Deployment(BaseModel):
    """Tracks a single deployment attempt for a project."""

    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="deployments",
    )
    status = models.CharField(
        max_length=20,
        choices=DeploymentStatus.choices,
        default=DeploymentStatus.PENDING,
    )

    # Snapshot of the graph at time of deploy.
    graph_snapshot = models.JSONField(
        help_text="Full nodes + edges + settings at deploy time.",
    )

    # Generated OpenTofu configuration.
    tofu_config = models.JSONField(
        null=True,
        blank=True,
        help_text="The .tf.json sent to the deployer.",
    )

    # Results from the deployer.
    tofu_state = models.JSONField(
        null=True,
        blank=True,
        help_text="OpenTofu state file contents after apply.",
    )
    tofu_plan_output = models.TextField(
        blank=True,
        default="",
        help_text="Human-readable plan output.",
    )

    # Structured logs — list of {level, message, timestamp} dicts.
    logs = models.JSONField(default=list)

    # Error info.
    error_message = models.TextField(blank=True, default="")

    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    objects = DeploymentManager()

    class Meta:
        ordering = ["-created_at"]
        db_table = "deployments_deployment"

    def __str__(self):
        return f"Deployment {self.id} ({self.status}) for project {self.project_id}"


class ProjectDeploymentState(BaseModel):
    """
    Tracks the current deployed state for a project.
    One-to-one with Project. Updated after each successful deployment.
    """

    project = models.OneToOneField(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="deployment_state",
    )
    last_deployment = models.ForeignKey(
        Deployment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )

    # The latest OpenTofu state — carried forward between deployments.
    tofu_state = models.JSONField(null=True, blank=True)

    # Hash of the last successfully deployed graph for quick dirty-checking.
    deployed_graph_hash = models.CharField(max_length=64, blank=True, default="")

    last_deployed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "deployments_project_deployment_state"

    def __str__(self):
        return f"DeploymentState for project {self.project_id}"


class DeployedResource(BaseModel):
    """Individual resource that exists in the cloud."""

    deployment_state = models.ForeignKey(
        ProjectDeploymentState,
        on_delete=models.CASCADE,
        related_name="resources",
    )
    node_id = models.CharField(max_length=255, help_text="Canvas node ID.")
    service_id = models.CharField(max_length=100, help_text="e.g. 'lambda'.")
    resource_identifier = models.CharField(
        max_length=500,
        help_text="e.g. ARN or resource name.",
    )
    config_hash = models.CharField(max_length=64)
    status = models.CharField(max_length=20, default="active")

    class Meta:
        db_table = "deployments_deployed_resource"

    def __str__(self):
        return f"{self.service_id}:{self.resource_identifier} ({self.status})"
