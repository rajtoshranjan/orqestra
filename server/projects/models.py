from django.db import models

from orqestra.models import BaseModel


class Project(BaseModel):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    nodes = models.JSONField(default=list, blank=True)
    edges = models.JSONField(default=list, blank=True)
    deployment_settings = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return self.name
