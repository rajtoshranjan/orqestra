import json
import uuid
from collections.abc import Iterator

from django.conf import settings

from .base import BaseLLMProvider
from .mappers import to_ollama_messages, to_ollama_tools
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


class OllamaProvider(BaseLLMProvider):
    """Local models served by Ollama, over its native /api/chat endpoint.

    Talks HTTP directly rather than pulling in an SDK: the payload is a couple
    of JSON keys and `requests` is already a dependency.
    """

    name = "ollama"
    capabilities = LLMCapabilities(
        supports_streaming=True, supports_tools=True, max_context_tokens=32768
    )

    def __init__(self, base_url: str | None = None, model: str | None = None):
        # Resolved lazily so registration never touches settings.
        self._base_url = base_url
        self._model = model

    def _get_base_url(self) -> str:
        return (self._base_url or settings.OLLAMA_BASE_URL).rstrip("/")

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
        import requests

        payload = {
            "model": self._get_model(),
            "messages": [
                {"role": "system", "content": system_prompt},
                *to_ollama_messages(messages),
            ],
            "tools": to_ollama_tools(tools),
            "stream": True,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
                # Ollama defaults to a 4096-token window, which silently truncates
                # the service catalog and canvas out of the system prompt.
                "num_ctx": settings.OLLAMA_NUM_CTX,
            },
        }

        try:
            response = requests.post(
                f"{self._get_base_url()}/api/chat",
                json=payload,
                stream=True,
                timeout=(10, settings.OLLAMA_READ_TIMEOUT),
            )
        except requests.exceptions.ConnectionError as error:
            raise RuntimeError(
                f"Cannot reach Ollama at {self._get_base_url()}. Is `ollama serve` "
                "running, and is OLLAMA_BASE_URL reachable from the container?"
            ) from error

        with response:
            if response.status_code != 200:
                body = response.text[:500]
                if "does not support tools" in body:
                    # The agent acts only through tools, so a model with no tool
                    # template cannot drive a run at all - say so plainly rather
                    # than surfacing Ollama's registry path.
                    raise RuntimeError(
                        f"The Ollama model '{self._get_model()}' has no tool-calling "
                        "support, and the agent can only act through tools. Pick a "
                        "tool-capable model (for example qwen3:8b, llama3.1:8b, or "
                        "mistral-nemo), pull it with `ollama pull`, and set "
                        "AGENT_LLM_MODEL to it."
                    )
                raise RuntimeError(f"Ollama returned {response.status_code}: {body}")

            tool_calls: list[ToolCallRequested] = []
            finish_reason = "stop"
            input_tokens = output_tokens = 0

            for line in response.iter_lines():
                if not line:
                    continue
                chunk = json.loads(line)

                if chunk.get("error"):
                    raise RuntimeError(f"Ollama error: {chunk['error']}")

                message = chunk.get("message") or {}

                # `thinking` is deliberately dropped: reasoning models stream it
                # as a separate field and it is not part of the reply.
                text = message.get("content")
                if text:
                    yield TextDelta(text=text)

                for call in message.get("tool_calls") or []:
                    function = call.get("function") or {}
                    arguments = function.get("arguments") or {}
                    if isinstance(arguments, str):
                        arguments = json.loads(arguments)
                    # Ollama does not issue call ids; the engine pairs calls to
                    # results by id, so mint a stable one here.
                    tool_calls.append(
                        ToolCallRequested(
                            id=f"call_{uuid.uuid4().hex[:12]}",
                            name=function.get("name", ""),
                            input=arguments,
                        )
                    )

                if chunk.get("done"):
                    finish_reason = chunk.get("done_reason") or "stop"
                    input_tokens = chunk.get("prompt_eval_count") or 0
                    output_tokens = chunk.get("eval_count") or 0

        for call in tool_calls:
            yield call

        yield Usage(input_tokens=input_tokens, output_tokens=output_tokens)
        yield Stop(reason=finish_reason)
