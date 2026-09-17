from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone
from orqestra.env_variables import EnvVariable
from orqestra.models import BaseModel

from .constants import TERMINAL_RUN_STATUSES, ConversationStatus, MessageRole, RunStatus


class AgentConversation(BaseModel):
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="agent_conversations"
    )
    # Set when the conversation is anchored to a canvas @orqestra comment thread.
    # Null for standalone "build chat" conversations shown in the agent panel.
    # CASCADE so a deleted thread's chat can't resurface as a standalone build chat.
    annotation = models.ForeignKey(
        "annotations.Annotation",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="agent_conversations",
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
    # Client-supplied service catalog snapshot (frontend registry projection),
    # used by the engine for prompt + grounding. Stored once at creation.
    catalog = models.JSONField(default=list, blank=True)

    class Meta(BaseModel.Meta):
        db_table = "agent_conversations"

    def __str__(self):
        return f"Conversation {self.id} on {self.project_id}"


class AgentMessage(BaseModel):
    conversation = models.ForeignKey(
        AgentConversation, on_delete=models.CASCADE, related_name="messages"
    )
    # The run that produced this message. Null for user messages and for rows
    # written before runs were tracked. Lets a run's narration be recovered
    # exactly — which is what the annotation reply endpoint posts, rather than
    # trusting a caller-supplied body.
    run = models.ForeignKey(
        "AgentRun",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="messages",
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


class AgentRunQuerySet(models.QuerySet):
    def live(self):
        return self.exclude(status__in=TERMINAL_RUN_STATUSES)

    def expire_stale(self) -> int:
        """Fail runs abandoned mid-flight (a closed tab, a dropped connection).

        Without this a run stuck in `awaiting_client` would block its
        conversation forever, since a new message is refused while one is live.
        """
        cutoff = timezone.now() - timedelta(
            minutes=int(EnvVariable.AGENT_RUN_STALE_MINUTES.value)
        )
        return (
            self.live()
            .filter(updated_at__lt=cutoff)
            .update(
                status=RunStatus.FAILED.value,
                error="This run was interrupted and did not finish.",
                updated_at=timezone.now(),
            )
        )


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
    # Tool results the server already resolved for this turn (read-only operations it
    # answered itself). Merged with the client's results on the next advance so
    # the TOOL message carries a result for every outstanding tool call.
    resolved_results = models.JSONField(default=list, blank=True)

    objects = AgentRunQuerySet.as_manager()

    class Meta(BaseModel.Meta):
        db_table = "agent_runs"

    def __str__(self):
        return f"Run {self.id} ({self.status})"

    @property
    def organisation(self):
        return self.conversation.project.organisation

    @property
    def is_terminal(self) -> bool:
        return self.status in TERMINAL_RUN_STATUSES

    @property
    def is_advanceable(self) -> bool:
        """Only a run waiting on the client has outstanding work to report."""
        return self.status == RunStatus.AWAITING_CLIENT.value

    def narration(self) -> str:
        """Everything the model said out loud during this run, in order."""
        parts: list[str] = []
        for message in self.messages.filter(role=MessageRole.ASSISTANT.value).order_by(
            "created_at"
        ):
            for block in message.content:
                if block.get("type") == "text" and block.get("text", "").strip():
                    parts.append(block["text"].strip())
        return "\n\n".join(parts)

    def outstanding_operations(self) -> list[dict]:
        """The tool calls still awaiting a result, with their risk grade.

        Lets a surface that did not start the run — a reloaded panel, or a
        comment thread picking a paused run back up — say exactly what it is
        being asked to approve.
        """
        from .risk import classify_operation_risk

        outstanding = self.outstanding_tool_call_ids()
        operations: list[dict] = []
        for message in self.conversation.messages.all():
            for block in message.content:
                if block.get("type") != "tool_call":
                    continue
                if block.get("id") not in outstanding:
                    continue
                operation_input = block.get("input") or {}
                operations.append(
                    {
                        "tool_call_id": block["id"],
                        "name": block.get("name"),
                        "input": operation_input,
                        "risk": classify_operation_risk(
                            block.get("name"), operation_input
                        ).value,
                    }
                )
        return operations

    def outstanding_tool_call_ids(self) -> set[str]:
        """Tool calls in this conversation that have no result yet.

        The client is the source of truth for operation results, so `advance` filters
        what it reports against this set: a duplicate or invented tool_call_id
        would otherwise be replayed as an unmatched tool_result and rejected by
        the provider on every later turn.
        """
        called: set[str] = set()
        resolved: set[str] = set()
        for message in self.conversation.messages.all():
            for block in message.content:
                if block.get("type") == "tool_call":
                    called.add(block.get("id"))
                elif block.get("type") == "tool_result":
                    resolved.add(block.get("tool_call_id"))
        return called - resolved
