from typing import Any

from .types import (
    LLMMessage,
    Role,
    TextBlock,
    ToolCallBlock,
    ToolResultBlock,
    ToolSpec,
)


def to_anthropic_tools(tools: list[ToolSpec]) -> list[dict[str, Any]]:
    return [
        {"name": tool.name, "description": tool.description, "input_schema": tool.input_schema}
        for tool in tools
    ]


def to_anthropic_messages(messages: list[LLMMessage]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for message in messages:
        content: list[dict[str, Any]] = []
        for block in message.content:
            if isinstance(block, TextBlock):
                content.append({"type": "text", "text": block.text})
            elif isinstance(block, ToolCallBlock):
                content.append(
                    {"type": "tool_use", "id": block.id, "name": block.name, "input": block.input}
                )
            elif isinstance(block, ToolResultBlock):
                content.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.tool_call_id,
                        "content": block.content,
                        "is_error": block.is_error,
                    }
                )
        # Anthropic only accepts "user"/"assistant"; tool results ride in a user turn.
        role = "assistant" if message.role == Role.ASSISTANT else "user"
        result.append({"role": role, "content": content})
    return result
