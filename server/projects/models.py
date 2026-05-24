from django.db import models
from draw_to_deploy.models import BaseModel


class Project(BaseModel):
    """
    Project model representing an architecture diagram layout.
    """

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    nodes = models.JSONField(default=list, blank=True)
    edges = models.JSONField(default=list, blank=True)
    deployment_settings = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "projects"
        ordering = ["-updated_at"]

    def __str__(self):
        return self.name
