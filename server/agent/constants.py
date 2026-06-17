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

    @classmethod
    def choices(cls):
        return [(key.value, key.name) for key in cls]


class RiskLevel(Enum):
    SAFE = "safe"
    CONFIRM = "confirm"

    @classmethod
    def choices(cls):
        return [(key.value, key.name) for key in cls]


# Realtime event types (Plan B maps these onto send_agent_event).
AGENT_MESSAGE_DELTA = "agent.message.delta"
AGENT_TOOL_CALL = "agent.tool_call"
AGENT_OP_APPLIED = "agent.op_applied"
AGENT_RUN_COMPLETED = "agent.run.completed"
AGENT_RUN_FAILED = "agent.run.failed"

# Stable identity for agent-authored content (Comment.origin, mention tokens).
AGENT_ID = "orqestra"
AGENT_DISPLAY_NAME = "Orqestra"
