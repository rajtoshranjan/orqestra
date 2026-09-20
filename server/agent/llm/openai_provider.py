from collections.abc import Iterator

import requests
from orqestra.env_variables import EnvVariable

from .base import BaseLLMProvider
from .errors import safe_call, safe_stream, status_error
from .mappers import (
    from_openai_models,
    from_openai_stream,
    openai_context_limit,
    to_openai_request,
)
from .types import LLMCapabilities, LLMEvent, LLMMessage, LLMModel, ToolSpec


class OpenAIProvider(BaseLLMProvider):
    """API-key OpenAI Chat Completions; no subscription or OAuth credentials."""

    name = "openai"
    endpoint = "https://api.openai.com/v1"
    capabilities = LLMCapabilities(max_context_tokens=4096)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        context_limit = openai_context_limit(self._model)
        if self._context_window:
            context_limit = min(context_limit, self._context_window)
        self.capabilities = LLMCapabilities(max_context_tokens=context_limit)

    @safe_call
    def list_models(self) -> list[LLMModel]:
        self._require_api_key()
        return self._list_catalog("/models", from_openai_models)

    @safe_stream
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
        self._require_api_key()
        payload = to_openai_request(
            model=self._get_model(),
            system_prompt=system_prompt,
            messages=messages,
            tools=tools,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        with requests.post(
            f"{self.endpoint}/chat/completions",
            json=payload,
            headers=self._get_headers(),
            stream=True,
            allow_redirects=False,
            timeout=(10, int(EnvVariable.AGENT_REQUEST_TIMEOUT.value)),
        ) as response:
            if response.status_code != 200:
                raise status_error(response.status_code)
            yield from from_openai_stream(response.iter_lines())
