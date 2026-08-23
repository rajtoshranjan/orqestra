from typing import Any

from .types import LLMMessage, Role, TextBlock, ToolCallBlock, ToolResultBlock, ToolSpec


def to_anthropic_tools(tools: list[ToolSpec]) -> list[dict[str, Any]]:
    return [
        {
            "name": tool.name,
            "description": tool.description,
            "input_schema": tool.input_schema,
        }
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
