from collections.abc import Iterator

from django.conf import settings

from .base import BaseLLMProvider
from .mappers import to_anthropic_messages, to_anthropic_tools
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


class AnthropicProvider(BaseLLMProvider):
    name = "anthropic"
    capabilities = LLMCapabilities(supports_streaming=True, supports_tools=True, max_context_tokens=200000)

    def __init__(self, client=None, model: str | None = None):
        # Client/model resolved lazily so registration never requires an API key.
        self._client = client
        self._model = model

    def _get_client(self):
        if self._client is None:
            import anthropic

            self._client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
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
        with client.messages.stream(
            model=self._get_model(),
            system=system_prompt,
            max_tokens=max_tokens,
            temperature=temperature,
            tools=to_anthropic_tools(tools),
            messages=to_anthropic_messages(messages),
        ) as stream:
            for text in stream.text_stream:
                yield TextDelta(text=text)
            final = stream.get_final_message()

        for block in final.content:
            if block.type == "tool_use":
                yield ToolCallRequested(id=block.id, name=block.name, input=dict(block.input))
        yield Usage(
            input_tokens=final.usage.input_tokens,
            output_tokens=final.usage.output_tokens,
        )
        yield Stop(reason=final.stop_reason)
