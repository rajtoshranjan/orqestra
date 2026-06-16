from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Literal, Union


class Role(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


@dataclass
class TextBlock:
    text: str
    type: Literal["text"] = "text"


@dataclass
class ToolCallBlock:
    id: str
    name: str
    input: dict[str, Any]
    type: Literal["tool_call"] = "tool_call"


@dataclass
class ToolResultBlock:
    tool_call_id: str
    content: str
    is_error: bool = False
    type: Literal["tool_result"] = "tool_result"


ContentBlock = Union[TextBlock, ToolCallBlock, ToolResultBlock]


@dataclass
class LLMMessage:
    role: Role
    content: list[ContentBlock]


@dataclass
class ToolSpec:
    name: str
    description: str
    input_schema: dict[str, Any]


@dataclass
class LLMCapabilities:
    supports_streaming: bool = True
    supports_tools: bool = True
    max_context_tokens: int = 200000


# --- Streaming events -------------------------------------------------------


@dataclass
class TextDelta:
    text: str
    type: Literal["text_delta"] = "text_delta"


@dataclass
class ToolCallRequested:
    id: str
    name: str
    input: dict[str, Any]
    type: Literal["tool_call"] = "tool_call"


@dataclass
class Usage:
    input_tokens: int
    output_tokens: int
    type: Literal["usage"] = "usage"


@dataclass
class Stop:
    reason: str
    type: Literal["stop"] = "stop"


LLMEvent = Union[TextDelta, ToolCallRequested, Usage, Stop]


# --- Content (de)serialization for persistence ------------------------------


def content_blocks_to_json(blocks: list[ContentBlock]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for block in blocks:
        if isinstance(block, TextBlock):
            result.append({"type": "text", "text": block.text})
        elif isinstance(block, ToolCallBlock):
            result.append(
                {"type": "tool_call", "id": block.id, "name": block.name, "input": block.input}
            )
        elif isinstance(block, ToolResultBlock):
            result.append(
                {
                    "type": "tool_result",
                    "tool_call_id": block.tool_call_id,
                    "content": block.content,
                    "is_error": block.is_error,
                }
            )
        else:  # pragma: no cover - defensive
            raise TypeError(f"Unknown content block: {block!r}")
    return result


def json_to_content_blocks(data: list[dict[str, Any]]) -> list[ContentBlock]:
    blocks: list[ContentBlock] = []
    for item in data:
        block_type = item.get("type")
        if block_type == "text":
            blocks.append(TextBlock(text=item["text"]))
        elif block_type == "tool_call":
            blocks.append(ToolCallBlock(id=item["id"], name=item["name"], input=item["input"]))
        elif block_type == "tool_result":
            blocks.append(
                ToolResultBlock(
                    tool_call_id=item["tool_call_id"],
                    content=item["content"],
                    is_error=item.get("is_error", False),
                )
            )
        else:  # pragma: no cover - defensive
            raise ValueError(f"Unknown content block type: {block_type!r}")
    return blocks
