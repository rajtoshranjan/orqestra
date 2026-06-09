from django.db import models

from orqestra.models import BaseModel


class Project(BaseModel):
    organisation = models.ForeignKey(
        "organisations.Organisation", on_delete=models.CASCADE, related_name="projects"
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    nodes = models.JSONField(default=list, blank=True)
    edges = models.JSONField(default=list, blank=True)
    deployment_settings = models.JSONField(default=dict, blank=True)
    aws_account = models.ForeignKey(
        "organisations.AWSAccount",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="projects",
    )

    def __str__(self):
        return self.name

