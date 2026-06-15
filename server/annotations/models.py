from django.conf import settings
from django.db import models
from orqestra.models import BaseModel

from .constants import (
    AnnotationEventType,
    AnnotationStatus,
    AnnotationTargetType,
    AuthorType,
    NotificationVerb,
)
from .querysets import AnnotationQuerySet, NotificationQuerySet


class Annotation(BaseModel):
    """
    A discussion thread anchored to the architecture.

    Targets are generic string references into the project's canvas graph
    (nodes/edges are JSON blobs, not rows), so annotations survive graph
    edits and can extend to future object types without schema changes.
    The thread body lives in the first Comment row.
    """

    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="annotations"
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="annotations",
    )
    author_type = models.CharField(
        max_length=10,
        choices=AuthorType.choices(),
        default=AuthorType.USER.value,
    )
    # Identifies future non-human origins, e.g. "security-engine" or an agent id.
    origin = models.CharField(max_length=100, blank=True, default="")
    target_type = models.CharField(
        max_length=12, choices=AnnotationTargetType.choices()
    )
    # Canvas node/edge id or deployment id; empty for canvas-position annotations.
    target_id = models.CharField(max_length=255, blank=True, default="")
    # canvas: {"x", "y"} flow coordinates; node: {"dx", "dy"} offset from node top-left.
    position = models.JSONField(default=dict, blank=True)
    status = models.CharField(
        max_length=10,
        choices=AnnotationStatus.choices(),
        default=AnnotationStatus.OPEN.value,
    )
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resolved_annotations",
    )
    resolved_at = models.DateTimeField(null=True, blank=True)

    objects = AnnotationQuerySet.as_manager()

    class Meta(BaseModel.Meta):
        db_table = "annotations"
        indexes = [
            models.Index(fields=["project", "status"]),
            models.Index(fields=["project", "target_type", "target_id"]),
        ]

    def __str__(self):
        return f"Annotation {self.id} ({self.target_type}) on {self.project_id}"


class Comment(BaseModel):
    annotation = models.ForeignKey(
        Annotation, on_delete=models.CASCADE, related_name="comments"
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="annotation_comments",
    )
    author_type = models.CharField(
        max_length=10,
        choices=AuthorType.choices(),
        default=AuthorType.USER.value,
    )
    origin = models.CharField(max_length=100, blank=True, default="")
    # Markdown subset plus @[Name](user:<uuid>) mention tokens.
    body = models.TextField()
    edited_at = models.DateTimeField(null=True, blank=True)

    class Meta(BaseModel.Meta):
        db_table = "annotation_comments"
        ordering = ["created_at"]

    def __str__(self):
        return f"Comment {self.id} on annotation {self.annotation_id}"


class Mention(BaseModel):
    comment = models.ForeignKey(
        Comment, on_delete=models.CASCADE, related_name="mentions"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="annotation_mentions",
    )

    class Meta(BaseModel.Meta):
        db_table = "annotation_mentions"
        unique_together = ("comment", "user")

    def __str__(self):
        return f"Mention of {self.user_id} in comment {self.comment_id}"


class Reaction(BaseModel):
    comment = models.ForeignKey(
        Comment, on_delete=models.CASCADE, related_name="reactions"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="annotation_reactions",
    )
    emoji = models.CharField(max_length=16)

    class Meta(BaseModel.Meta):
        db_table = "annotation_reactions"
        unique_together = ("comment", "user", "emoji")

    def __str__(self):
        return f"{self.emoji} by {self.user_id} on comment {self.comment_id}"


class AnnotationEvent(BaseModel):
    """Per-annotation activity timeline. Org-level audit goes through log_action."""

    annotation = models.ForeignKey(
        Annotation, on_delete=models.CASCADE, related_name="events"
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="annotation_events",
    )
    event_type = models.CharField(max_length=20, choices=AnnotationEventType.choices())
    details = models.JSONField(default=dict, blank=True)

    class Meta(BaseModel.Meta):
        db_table = "annotation_events"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.event_type} on annotation {self.annotation_id}"


class Notification(BaseModel):
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="sent_notifications",
    )
    organisation = models.ForeignKey(
        "organisations.Organisation",
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    verb = models.CharField(max_length=12, choices=NotificationVerb.choices())
    annotation = models.ForeignKey(
        Annotation,
        on_delete=models.CASCADE,
        null=True,
        related_name="notifications",
    )
    comment = models.ForeignKey(
        Comment,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="notifications",
    )
    read_at = models.DateTimeField(null=True, blank=True)

    objects = NotificationQuerySet.as_manager()

    class Meta(BaseModel.Meta):
        db_table = "notifications"
        indexes = [
            models.Index(fields=["recipient", "read_at"]),
        ]

    def __str__(self):
        return f"{self.verb} notification for {self.recipient_id}"
