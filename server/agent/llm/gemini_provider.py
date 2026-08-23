from collections.abc import Iterator

from django.conf import settings

from .base import BaseLLMProvider
from .mappers import to_gemini_messages, to_gemini_tools
from .types import (
    LLMCapabilities,
    LLMEvent,
    LLMMessage,
    Stop,
    TextDelta,
    ToolCallRequested,
    ToolSpec,
    Usage,
)


class GeminiProvider(BaseLLMProvider):
    name = "gemini"
    capabilities = LLMCapabilities(
        supports_streaming=True, supports_tools=True, max_context_tokens=1000000
    )

    def __init__(self, client=None, model: str | None = None):
        self._client = client
        self._model = model

    def _get_client(self):
        if self._client is None:
            api_key = getattr(settings, "GEMINI_API_KEY", "") or None
            if not api_key:
                raise RuntimeError(
                    "The agent is not configured: GEMINI_API_KEY is missing on the "
                    "server. Set it (or switch AGENT_LLM_PROVIDER) and retry."
                )
            from google import genai

            self._client = genai.Client(api_key=api_key)
        return self._client

    def _get_model(self) -> str:
        return self._model or settings.AGENT_LLM_MODEL

    def stream(
        self,
        *,
        system_prompt: str,
        messages: list[LLMMessage],
        tools: list[ToolSpec],
        temperature: float = 0.0,
        max_tokens: int = 4096,
    ) -> Iterator[LLMEvent]:
        client = self._get_client()
        from google.genai import types

        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=temperature,
            max_output_tokens=max_tokens,
            tools=to_gemini_tools(tools),
        )

        response_stream = client.models.generate_content_stream(
            model=self._get_model(),
            contents=to_gemini_messages(messages),
            config=config,
        )

        tool_calls: list[ToolCallRequested] = []
        finish_reason = "stop"
        usage_event = None

        for chunk in response_stream:
            try:
                text = chunk.text
            except ValueError:
                text = None
            if text:
                yield TextDelta(text=text)

            if chunk.function_calls:
                for call in chunk.function_calls:
                    tool_calls.append(
                        ToolCallRequested(
                            id=call.id or "",
                            name=call.name,
                            input=call.args or {},
                        )
                    )

            if chunk.usage_metadata:
                usage_event = Usage(
                    input_tokens=chunk.usage_metadata.prompt_token_count or 0,
                    output_tokens=chunk.usage_metadata.candidates_token_count or 0,
                )

            if chunk.candidates:
                candidate = chunk.candidates[0]
                if candidate.finish_reason:
                    reason = str(candidate.finish_reason)
                    if hasattr(candidate.finish_reason, "name"):
                        reason = candidate.finish_reason.name
                    elif hasattr(candidate.finish_reason, "value"):
                        reason = candidate.finish_reason.value
                    finish_reason = reason.lower()

        for call in tool_calls:
            yield call

        if usage_event:
            yield usage_event
        else:
            yield Usage(input_tokens=0, output_tokens=0)

        yield Stop(reason=finish_reason)
