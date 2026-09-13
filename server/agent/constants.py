from enum import Enum


class ConversationStatus(Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"

    @classmethod
    def choices(cls):
        return [(key.value, key.name) for key in cls]


class MessageRole(Enum):
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"

    @classmethod
    def choices(cls):
        return [(key.value, key.name) for key in cls]


class RunStatus(Enum):
    RUNNING = "running"
    AWAITING_CLIENT = "awaiting_client"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

    @classmethod
    def choices(cls):
        return [(key.value, key.name) for key in cls]


class RiskLevel(Enum):
    SAFE = "safe"
    CONFIRM = "confirm"

    @classmethod
    def choices(cls):
        return [(key.value, key.name) for key in cls]


# A run in one of these states is finished: nothing further may advance it.
TERMINAL_RUN_STATUSES = frozenset(
    {
        RunStatus.COMPLETED.value,
        RunStatus.FAILED.value,
        RunStatus.CANCELLED.value,
    }
)

# Provider stop reasons meaning the turn was cut off rather than finished. The
# model's plan is incomplete, so the run must fail loudly instead of looking
# like a clean finish.
TRUNCATION_STOP_REASONS = frozenset({"max_tokens", "length", "max_output_tokens"})

# Realtime event types (Plan B maps these onto send_agent_event).
# One event per completed model turn. Emitting per token put a channel-layer
# round trip on the hot path for every delta, into a group nothing consumes.
AGENT_MESSAGE = "agent.message"
AGENT_TOOL_CALL = "agent.tool_call"
AGENT_OP_APPLIED = "agent.op_applied"
AGENT_RUN_COMPLETED = "agent.run.completed"
AGENT_RUN_FAILED = "agent.run.failed"

# Stable identity for agent-authored content (Comment.origin, mention tokens).
AGENT_ID = "orqestra"
AGENT_DISPLAY_NAME = "Orqestra"
