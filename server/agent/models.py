from django.conf import settings
from django.db import models
from orqestra.models import BaseModel

from .constants import ConversationStatus, MessageRole, RunStatus


class AgentConversation(BaseModel):
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="agent_conversations"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="agent_conversations",
    )
    title = models.CharField(max_length=255, blank=True, default="")
    status = models.CharField(
        max_length=12,
        choices=ConversationStatus.choices(),
        default=ConversationStatus.ACTIVE.value,
    )

    class Meta(BaseModel.Meta):
        db_table = "agent_conversations"

    def __str__(self):
        return f"Conversation {self.id} on {self.project_id}"


class AgentMessage(BaseModel):
    conversation = models.ForeignKey(
        AgentConversation, on_delete=models.CASCADE, related_name="messages"
    )
    role = models.CharField(max_length=10, choices=MessageRole.choices())
    # Serialized list of content blocks (see agent.llm.types.content_blocks_to_json).
    content = models.JSONField(default=list)
    input_tokens = models.PositiveIntegerField(default=0)
    output_tokens = models.PositiveIntegerField(default=0)

    class Meta(BaseModel.Meta):
        db_table = "agent_messages"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.role} message {self.id}"


class AgentRun(BaseModel):
    conversation = models.ForeignKey(
        AgentConversation, on_delete=models.CASCADE, related_name="runs"
    )
    status = models.CharField(
        max_length=16, choices=RunStatus.choices(), default=RunStatus.RUNNING.value
    )
    turn_count = models.PositiveIntegerField(default=0)
    input_tokens = models.PositiveIntegerField(default=0)
    output_tokens = models.PositiveIntegerField(default=0)
    error = models.TextField(blank=True, default="")

    class Meta(BaseModel.Meta):
        db_table = "agent_runs"

    def __str__(self):
        return f"Run {self.id} ({self.status})"
