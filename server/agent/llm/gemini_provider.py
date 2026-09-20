from collections.abc import Iterator
from urllib.parse import quote

import requests
from orqestra.env_variables import EnvVariable

from .base import BaseLLMProvider
from .errors import safe_call, safe_stream, status_error
from .mappers import from_gemini_models, from_gemini_stream, to_gemini_request
from .types import LLMCapabilities, LLMEvent, LLMMessage, LLMModel, ToolSpec


class GeminiProvider(BaseLLMProvider):
    name = "gemini"
    endpoint = "https://generativelanguage.googleapis.com"
    capabilities = LLMCapabilities(
        supports_streaming=True, supports_tools=True, max_context_tokens=1000000
    )

    def _get_headers(self) -> dict[str, str]:
        return {"x-goog-api-key": self._api_key}

    @safe_call
    def list_models(self) -> list[LLMModel]:
        self._require_api_key()
        return self._list_catalog(
            "/v1beta/models",
            from_gemini_models,
            page_parameter="pageToken",
            params={"pageSize": 100},
        )

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
        model = quote(self._get_model().removeprefix("models/"), safe="")
        # The pinned SDK follows redirects without a per-client opt-out. Own
        # the transport so a redirect cannot forward x-goog-api-key elsewhere.
        with requests.post(
            f"{self.endpoint}/v1beta/models/{model}:streamGenerateContent",
            params={"alt": "sse"},
            json=to_gemini_request(
                system_prompt=system_prompt,
                messages=messages,
                tools=tools,
                temperature=temperature,
                max_tokens=max_tokens,
            ),
            headers=self._get_headers(),
            stream=True,
            allow_redirects=False,
            timeout=(10, int(EnvVariable.AGENT_REQUEST_TIMEOUT.value)),
        ) as response:
            if response.status_code != 200:
                raise status_error(response.status_code)
            yield from from_gemini_stream(response.iter_lines())
