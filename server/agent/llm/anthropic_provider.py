from collections.abc import Iterator

from orqestra.env_variables import EnvVariable

from .base import BaseLLMProvider
from .mappers import to_anthropic_messages, to_anthropic_system, to_anthropic_tools
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
    capabilities = LLMCapabilities(
        supports_streaming=True, supports_tools=True, max_context_tokens=200000
    )

    def __init__(self, client=None, **kwargs):
        super().__init__(**kwargs)
        # An injected client is for tests; production builds one from the key.
        self._client = client

    def _get_client(self):
        if self._client is None:
            if not self._api_key:
                raise RuntimeError(
                    "This Anthropic model has no API key. Add one in "
                    "Settings → AI Models."
                )
            import anthropic

            # An explicit timeout: the turn runs inside a request, so an
            # unbounded wait holds a worker until the client gives up.
            self._client = anthropic.Anthropic(
                api_key=self._api_key,
                timeout=float(EnvVariable.AGENT_REQUEST_TIMEOUT.value),
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
        cacheable_prefix: str = "",
    ) -> Iterator[LLMEvent]:
        client = self._get_client()
        with client.messages.stream(
            model=self._get_model(),
            system=to_anthropic_system(system_prompt, cacheable_prefix),
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
                yield ToolCallRequested(
                    id=block.id, name=block.name, input=dict(block.input)
                )
        yield Usage(
            input_tokens=final.usage.input_tokens,
            output_tokens=final.usage.output_tokens,
        )
        yield Stop(reason=final.stop_reason)
