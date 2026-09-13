from collections.abc import Iterator

from orqestra.env_variables import EnvVariable

from .base import BaseLLMProvider
from .mappers import ensure_tool_call_id, to_gemini_messages, to_gemini_tools
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

    def __init__(self, client=None, **kwargs):
        super().__init__(**kwargs)
        # An injected client is for tests; production builds one from the key.
        self._client = client

    def _get_client(self):
        if self._client is None:
            if not self._api_key:
                raise RuntimeError(
                    "This Gemini model has no API key. Add one in "
                    "Settings → AI Models."
                )
            from google import genai
            from google.genai import types

            # Bounded like the other adapters: the turn runs inside a request.
            self._client = genai.Client(
                api_key=self._api_key,
                http_options=types.HttpOptions(
                    timeout=int(EnvVariable.AGENT_REQUEST_TIMEOUT.value) * 1000
                ),
            )
        return self._client

    def stream(
        self,
        *,
        system_prompt: str,
        messages: list[LLMMessage],
        tools: list[ToolSpec],
        temperature: float = 0.0,
        max_tokens: int = 4096,
        cacheable_prefix: str = "",  # noqa: ARG002 - no vendor equivalent yet
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
                            id=ensure_tool_call_id(call.id),
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
