import json
import re
import uuid
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from typing import Any

from orqestra.exceptions.api import LLMProviderError

from .types import (
    LLMEvent,
    LLMMessage,
    LLMModel,
    ModelCatalogPage,
    Role,
    Stop,
    TextBlock,
    TextDelta,
    ToolCallBlock,
    ToolCallRequested,
    ToolResultBlock,
    ToolSpec,
    Usage,
)


def ensure_tool_call_id(candidate: str | None) -> str:
    """Return a usable tool-call id, minting one when the vendor issues none.

    The engine pairs a tool_use to its tool_result by id when replaying history,
    so an empty id makes parallel calls in one turn indistinguishable and
    attributes results to the wrong call. Ollama issues no ids at all and Gemini
    leaves them unset for ordinary function calls, so normalising here means the
    next adapter inherits the fix instead of rediscovering it.
    """
    return candidate or f"call_{uuid.uuid4().hex[:12]}"


def to_anthropic_tools(tools: list[ToolSpec]) -> list[dict[str, Any]]:
    return [
        {
            "name": tool.name,
            "description": tool.description,
            "input_schema": tool.input_schema,
        }
        for tool in tools
    ]


def to_anthropic_system(
    system_prompt: str, cacheable_prefix: str = ""
) -> str | list[dict[str, Any]]:
    """Split the system prompt so its stable half can be cached.

    The catalog block is identical on every turn of a run and is by far the
    largest part of the prompt, so marking it as a cache breakpoint avoids
    re-paying for it each turn. Without a usable prefix the plain string is
    returned unchanged.
    """
    if not cacheable_prefix or not system_prompt.startswith(cacheable_prefix):
        return system_prompt
    remainder = system_prompt[len(cacheable_prefix) :]
    blocks: list[dict[str, Any]] = [
        {
            "type": "text",
            "text": cacheable_prefix,
            "cache_control": {"type": "ephemeral"},
        }
    ]
    if remainder.strip():
        blocks.append({"type": "text", "text": remainder})
    return blocks


def to_anthropic_messages(messages: list[LLMMessage]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for message in messages:
        content: list[dict[str, Any]] = []
        for block in message.content:
            if isinstance(block, TextBlock):
                content.append({"type": "text", "text": block.text})
            elif isinstance(block, ToolCallBlock):
                content.append(
                    {
                        "type": "tool_use",
                        "id": block.id,
                        "name": block.name,
                        "input": block.input,
                    }
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


def _sanitize_gemini_schema(schema: Any) -> Any:
    if isinstance(schema, dict):
        new_schema = {}
        for key, value in schema.items():
            if key == "type" and isinstance(value, list):
                types_list = [type_str for type_str in value if type_str != "null"]
                new_schema[key] = types_list[0] if types_list else "string"
            else:
                new_schema[key] = _sanitize_gemini_schema(value)
        return new_schema
    elif isinstance(schema, list):
        return [_sanitize_gemini_schema(item) for item in schema]
    return schema


def to_gemini_tools(tools: list[ToolSpec]) -> list[Any]:
    from google.genai import types

    declarations = [
        types.FunctionDeclaration(
            name=tool.name,
            description=tool.description,
            parameters=_sanitize_gemini_schema(tool.input_schema),
        )
        for tool in tools
    ]
    return [types.Tool(function_declarations=declarations)] if declarations else []


def to_gemini_messages(messages: list[LLMMessage]) -> list[Any]:
    from google.genai import types

    # Pre-scan messages to build a map from tool_call_id -> tool_name.
    tool_name_map = {}
    for msg in messages:
        if msg.role == Role.ASSISTANT:
            for block in msg.content:
                if isinstance(block, ToolCallBlock):
                    tool_name_map[block.id] = block.name

    result: list[types.Content] = []
    for msg in messages:
        parts: list[types.Part] = []
        for block in msg.content:
            if isinstance(block, TextBlock):
                parts.append(types.Part.from_text(text=block.text))
            elif isinstance(block, ToolCallBlock):
                parts.append(
                    types.Part(
                        function_call=types.FunctionCall(
                            name=block.name,
                            args=block.input,
                            id=block.id,
                        )
                    )
                )
            elif isinstance(block, ToolResultBlock):
                tool_name = tool_name_map.get(block.tool_call_id, "unknown_tool")
                parts.append(
                    types.Part(
                        function_response=types.FunctionResponse(
                            name=tool_name,
                            response={"result": block.content},
                            id=block.tool_call_id,
                        )
                    )
                )

        # Determine the Gemini role: Role.USER -> "user", Role.ASSISTANT -> "model", Role.TOOL -> "tool".
        if msg.role == Role.ASSISTANT:
            gemini_role = "model"
        elif msg.role == Role.TOOL:
            gemini_role = "tool"
        else:
            gemini_role = "user"

        result.append(types.Content(role=gemini_role, parts=parts))
    return result


def to_ollama_tools(tools: list[ToolSpec]) -> list[dict[str, Any]]:
    return [
        {
            "type": "function",
            "function": {
                "name": tool.name,
                "description": tool.description,
                "parameters": tool.input_schema,
            },
        }
        for tool in tools
    ]


def to_ollama_messages(messages: list[LLMMessage]) -> list[dict[str, Any]]:
    """Flatten canonical messages into Ollama's /api/chat shape.

    Ollama has no multi-block content: each message carries a single `content`
    string, tool calls ride in `tool_calls`, and every tool result must be its
    own `role: "tool"` message keyed by tool *name* rather than call id.
    """
    # Ollama identifies a tool result by name, so recover the name each call id
    # was issued under (the same lookup to_gemini_messages needs).
    tool_name_map = {
        block.id: block.name
        for message in messages
        if message.role == Role.ASSISTANT
        for block in message.content
        if isinstance(block, ToolCallBlock)
    }

    result: list[dict[str, Any]] = []
    for message in messages:
        text_parts: list[str] = []
        tool_calls: list[dict[str, Any]] = []

        for block in message.content:
            if isinstance(block, TextBlock):
                text_parts.append(block.text)
            elif isinstance(block, ToolCallBlock):
                tool_calls.append(
                    {"function": {"name": block.name, "arguments": block.input}}
                )
            elif isinstance(block, ToolResultBlock):
                # Emitted immediately as its own message to preserve ordering.
                result.append(
                    {
                        "role": "tool",
                        "tool_name": tool_name_map.get(
                            block.tool_call_id, "unknown_tool"
                        ),
                        "content": block.content,
                    }
                )

        if not text_parts and not tool_calls:
            continue

        entry: dict[str, Any] = {
            "role": "assistant" if message.role == Role.ASSISTANT else "user",
            "content": "".join(text_parts),
        }
        if tool_calls:
            entry["tool_calls"] = tool_calls
        result.append(entry)
    return result


def to_openai_tools(tools: list[ToolSpec]) -> list[dict[str, Any]]:
    return to_ollama_tools(tools)


def to_openai_messages(messages: list[LLMMessage]) -> list[dict[str, Any]]:
    result = []
    for message in messages:
        text = []
        calls = []
        for block in message.content:
            if isinstance(block, TextBlock):
                text.append(block.text)
            elif isinstance(block, ToolCallBlock):
                calls.append(
                    {
                        "id": block.id,
                        "type": "function",
                        "function": {
                            "name": block.name,
                            "arguments": json.dumps(block.input),
                        },
                    }
                )
            elif isinstance(block, ToolResultBlock):
                result.append(
                    {
                        "role": "tool",
                        "tool_call_id": block.tool_call_id,
                        "content": block.content,
                    }
                )
        if text or calls:
            entry = {"role": message.role.value, "content": "".join(text) or None}
            if calls:
                entry["tool_calls"] = calls
            result.append(entry)
    return result


def to_openai_request(
    *,
    model: str,
    system_prompt: str,
    messages: list[LLMMessage],
    tools: list[ToolSpec],
    temperature: float,
    max_tokens: int,
) -> dict[str, Any]:
    reasoning = model.startswith(("o1", "o3", "o4", "gpt-5"))
    limits = openai_model_limits(model) or _OPENAI_UNKNOWN_LIMITS
    output_tokens = min(max_tokens, limits.max_output_tokens)
    payload = {
        "model": model,
        "messages": [
            {
                "role": "developer" if reasoning else "system",
                "content": system_prompt,
            },
            *to_openai_messages(messages),
        ],
        "stream": True,
        "stream_options": {"include_usage": True},
        "max_completion_tokens" if reasoning else "max_tokens": output_tokens,
    }
    if not reasoning:
        payload["temperature"] = temperature
    if tools:
        payload["tools"] = to_openai_tools(tools)
    return payload


def _sse_data(lines: Iterable[bytes]) -> Iterator[str]:
    data = []
    for line in lines:
        line = line.decode("utf-8") if isinstance(line, bytes) else line
        if not line:
            if data:
                yield "\n".join(data)
                data = []
        elif line.startswith("data:"):
            data.append(line[5:].lstrip(" "))
    if data:
        yield "\n".join(data)


def to_gemini_request(
    *,
    system_prompt: str,
    messages: list[LLMMessage],
    tools: list[ToolSpec],
    temperature: float,
    max_tokens: int,
) -> dict[str, Any]:
    contents = []
    for message in to_gemini_messages(messages):
        parts = []
        for part in message.parts:
            if part.text is not None:
                parts.append({"text": part.text})
            elif part.function_call:
                call = part.function_call
                parts.append(
                    {
                        "functionCall": {
                            "id": call.id,
                            "name": call.name,
                            "args": call.args,
                        }
                    }
                )
            elif part.function_response:
                result = part.function_response
                parts.append(
                    {
                        "functionResponse": {
                            "id": result.id,
                            "name": result.name,
                            "response": result.response,
                        }
                    }
                )
        contents.append(
            {
                "role": "model" if message.role == "model" else "user",
                "parts": parts,
            }
        )
    payload = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": contents,
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_tokens,
        },
    }
    declarations = [
        {
            "name": declaration.name,
            "description": declaration.description,
            "parameters": declaration.parameters.model_dump(
                mode="json", by_alias=True, exclude_none=True,
            ),
        }
        for tool in to_gemini_tools(tools)
        for declaration in tool.function_declarations
    ]
    if declarations:
        payload["tools"] = [{"functionDeclarations": declarations}]
    return payload


def from_gemini_stream(lines: Iterable[bytes]) -> Iterator[LLMEvent]:
    calls = []
    usage = Usage(input_tokens=0, output_tokens=0)
    finish_reason = ""
    for data in _sse_data(lines):
        chunk = json.loads(data)
        if chunk.get("error"):
            raise LLMProviderError(
                "Gemini could not complete the response. Retry the request."
            )
        metadata = chunk.get("usageMetadata") or {}
        if metadata:
            usage = Usage(
                input_tokens=metadata.get("promptTokenCount", 0),
                output_tokens=(
                    metadata.get("candidatesTokenCount", 0)
                    + metadata.get("thoughtsTokenCount", 0)
                ),
            )
        candidates = chunk.get("candidates") or []
        if not candidates:
            continue
        candidate = candidates[0]
        for part in (candidate.get("content") or {}).get("parts", []):
            if part.get("text") and not part.get("thought"):
                yield TextDelta(text=part["text"])
            call = part.get("functionCall")
            if call:
                arguments = call.get("args") or {}
                if not isinstance(arguments, dict) or not call.get("name"):
                    raise LLMProviderError(
                        "Gemini returned an invalid tool call. Retry the request."
                    )
                calls.append(
                    ToolCallRequested(
                        id=ensure_tool_call_id(call.get("id")),
                        name=call["name"],
                        input=arguments,
                    )
                )
        if candidate.get("finishReason"):
            finish_reason = candidate["finishReason"].lower()
    if not finish_reason:
        raise LLMProviderError(
            "Gemini ended the response unexpectedly. Check model access and retry."
        )
    if finish_reason == "stop":
        yield from calls
    yield usage
    yield Stop(reason=finish_reason)


def from_openai_stream(lines: Iterable[bytes]) -> Iterator[LLMEvent]:
    calls = {}
    usage = Usage(input_tokens=0, output_tokens=0)
    finish_reason = ""
    completed = False
    for data in _sse_data(lines):
        if data == "[DONE]":
            completed = True
            break
        chunk = json.loads(data)
        if chunk.get("error"):
            raise LLMProviderError(
                "OpenAI could not complete the response. Check model access and retry."
            )
        if chunk.get("usage"):
            usage = Usage(
                input_tokens=chunk["usage"].get("prompt_tokens", 0),
                output_tokens=chunk["usage"].get("completion_tokens", 0),
            )
        for choice in chunk.get("choices", []):
            if choice.get("index", 0) != 0:
                continue
            delta = choice.get("delta") or {}
            if delta.get("content"):
                yield TextDelta(text=delta["content"])
            for fragment in delta.get("tool_calls") or []:
                call = calls.setdefault(
                    fragment["index"], {"id": "", "name": "", "arguments": ""}
                )
                call["id"] += fragment.get("id") or ""
                function = fragment.get("function") or {}
                call["name"] += function.get("name") or ""
                call["arguments"] += function.get("arguments") or ""
            if choice.get("finish_reason"):
                finish_reason = choice["finish_reason"]
    if not completed or not finish_reason:
        raise LLMProviderError(
            "OpenAI ended the stream before completing the response. Retry the request."
        )
    # Never materialise partial operations from a truncated or filtered response.
    if finish_reason == "tool_calls":
        parsed_calls = []
        for index in sorted(calls):
            call = calls[index]
            try:
                arguments = json.loads(call["arguments"] or "{}")
            except (ValueError, TypeError):
                raise LLMProviderError(
                    "OpenAI returned invalid tool arguments. Retry the request."
                ) from None
            if not call["name"] or not isinstance(arguments, dict):
                raise LLMProviderError(
                    "OpenAI returned an invalid tool call. Retry the request."
                )
            parsed_calls.append(
                ToolCallRequested(
                    id=ensure_tool_call_id(call["id"]),
                    name=call["name"],
                    input=arguments,
                )
            )
        yield from parsed_calls
    yield usage
    yield Stop(reason=finish_reason)


def _catalog_rows(payload: dict, field: str) -> list[dict]:
    if not isinstance(payload, dict) or not isinstance(payload.get(field), list):
        raise LLMProviderError(
            "The provider returned an invalid model catalog. Check the endpoint and retry."
        )
    rows = payload[field]
    if any(not isinstance(row, dict) for row in rows):
        raise LLMProviderError(
            "The provider returned an invalid model catalog. Retry later."
        )
    return rows


def _catalog_model(model_id: str, name: str | None = None) -> LLMModel:
    name = model_id if name is None or name == "" else name
    if not isinstance(model_id, str) or not model_id or not isinstance(name, str):
        raise LLMProviderError(
            "The provider returned invalid model details. Check the endpoint and retry."
        )
    return LLMModel(id=model_id, name=name)


@dataclass(frozen=True)
class OpenAIModelLimits:
    max_context_tokens: int
    max_output_tokens: int


# Model pages at https://developers.openai.com/api/docs/models/{family}, checked
# 2026-09-18. Match documented snapshots explicitly: a new suffix must not inherit
# limits optimistically. This is metadata for live results, never a fallback list.
_OPENAI_MODEL_LIMITS = (
    (r"gpt-4\.1(?:-mini|-nano)?(?:-2025-04-14)?", OpenAIModelLimits(1047576, 32768)),
    (r"gpt-4o(?:-2024-08-06|-2024-11-20)?", OpenAIModelLimits(128000, 16384)),
    (r"gpt-4o-2024-05-13", OpenAIModelLimits(128000, 4096)),
    (r"gpt-4o-mini(?:-2024-07-18)?", OpenAIModelLimits(128000, 16384)),
    (r"gpt-4-turbo(?:-2024-04-09|-preview)?", OpenAIModelLimits(128000, 4096)),
    (r"gpt-4-(?:0125|1106)-preview", OpenAIModelLimits(128000, 4096)),
    (r"gpt-3\.5-turbo(?:-0125|-1106)?", OpenAIModelLimits(16385, 4096)),
    (r"o1(?:-2024-12-17)?", OpenAIModelLimits(200000, 100000)),
    (r"o3(?:-2025-04-16)?", OpenAIModelLimits(200000, 100000)),
    (r"o3-mini(?:-2025-01-31)?", OpenAIModelLimits(200000, 100000)),
    (r"o4-mini(?:-2025-04-16)?", OpenAIModelLimits(200000, 100000)),
    (r"gpt-5(?:-mini|-nano)?(?:-2025-08-07)?", OpenAIModelLimits(400000, 128000)),
    (r"gpt-5\.1(?:-2025-11-13)?", OpenAIModelLimits(400000, 128000)),
    (r"gpt-5\.2(?:-2025-12-11)?", OpenAIModelLimits(400000, 128000)),
)
_OPENAI_UNKNOWN_LIMITS = OpenAIModelLimits(4096, 1024)


def openai_model_limits(model_id: str) -> OpenAIModelLimits | None:
    for pattern, limits in _OPENAI_MODEL_LIMITS:
        if re.fullmatch(pattern, model_id):
            return limits
    return None


def openai_supports_tools(model_id: str) -> bool:
    # Older GPT-4 / GPT-3.5 combined-window variants are deliberately omitted:
    # their full window cannot serve as output allowance while reserving a prompt.
    return openai_model_limits(model_id) is not None


def openai_context_limit(model_id: str) -> int:
    return (openai_model_limits(model_id) or _OPENAI_UNKNOWN_LIMITS).max_context_tokens


def from_openai_models(payload: dict) -> ModelCatalogPage:
    models = []
    for row in _catalog_rows(payload, "data"):
        model_id = row.get("id")
        if not isinstance(model_id, str):
            raise LLMProviderError(
                "OpenAI returned an invalid model catalog. Retry later."
            )
        if openai_supports_tools(model_id):
            models.append(_catalog_model(model_id))
    return ModelCatalogPage(models=models)


def from_anthropic_models(payload: dict) -> ModelCatalogPage:
    models = []
    for row in _catalog_rows(payload, "data"):
        model_id = row.get("id")
        if not isinstance(model_id, str):
            raise LLMProviderError(
                "Anthropic returned an invalid model catalog. Retry later."
            )
        if model_id.startswith(
            ("claude-3", "claude-sonnet-", "claude-opus-", "claude-haiku-")
        ):
            models.append(_catalog_model(model_id, row.get("display_name")))
    cursor = payload.get("last_id") if payload.get("has_more") else ""
    if payload.get("has_more") and (not isinstance(cursor, str) or not cursor):
        raise LLMProviderError(
            "Anthropic returned an incomplete model catalog. Retry later."
        )
    return ModelCatalogPage(models=models, next_page=cursor or "")


def from_gemini_models(payload: dict) -> ModelCatalogPage:
    models = []
    # An empty Google list can omit the repeated field entirely.
    if "models" not in payload and set(payload) - {"nextPageToken"}:
        raise LLMProviderError("Gemini returned an invalid model catalog. Retry later.")
    for row in _catalog_rows({"models": [], **payload}, "models"):
        model_id = row.get("name")
        if not isinstance(model_id, str):
            raise LLMProviderError(
                "Gemini returned an invalid model catalog. Retry later."
            )
        model_id = model_id.removeprefix("models/")
        # Gemini 3 requires thought signatures on tool replay, which the
        # canonical history does not yet preserve. Do not advertise it here.
        if (
            "generateContent" in row.get("supportedGenerationMethods", [])
            and re.match(r"^gemini-(?:1\.5|2(?:\.\d+)?)-", model_id)
            and not any(
                part in model_id
                for part in (
                    "image", "vision", "embedding", "audio", "tts", "live",
                    "robotics", "computer-use",
                )
            )
        ):
            models.append(_catalog_model(model_id, row.get("displayName")))
    return ModelCatalogPage(models=models, next_page=payload.get("nextPageToken") or "")


def from_ollama_models(payload: dict) -> list[LLMModel]:
    models = []
    for row in _catalog_rows(payload, "models"):
        model_id = row.get("model") or row.get("name")
        if not isinstance(model_id, str):
            raise LLMProviderError(
                "Ollama returned an invalid model catalog. Retry later."
            )
        models.append(_catalog_model(model_id, row.get("name")))
    return models


def to_ollama_model_info(model: LLMModel) -> dict:
    return {"model": model.id}


def ollama_model_supports_tools(payload: dict) -> bool:
    # /api/show is authoritative, including for custom and renamed local models.
    # Older servers without capability metadata must be upgraded, not guessed at.
    if not isinstance(payload, dict) or not isinstance(
        payload.get("capabilities"), list
    ):
        raise LLMProviderError(
            "Ollama did not report model capabilities. Upgrade Ollama and retry discovery."
        )
    return "tools" in payload["capabilities"]
