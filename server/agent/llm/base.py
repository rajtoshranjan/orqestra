import asyncio
import json
from abc import ABC, abstractmethod
from collections.abc import Callable, Iterator
from time import monotonic

import httpx
from asgiref.sync import async_to_sync
from rest_framework.exceptions import ValidationError

from orqestra.env_variables import EnvVariable
from orqestra.exceptions.api import LLMProviderError

from .endpoints import normalize_base_url
from .errors import ERROR_MAX_BODY_BYTES, safe_call, status_error
from .types import (
    LLMCapabilities,
    LLMEvent,
    LLMMessage,
    LLMModel,
    ModelCatalogPage,
    ToolSpec,
)

CATALOG_MAX_BODY_BYTES = 1024 * 1024
CATALOG_READ_CHUNK_BYTES = 64 * 1024


class BaseLLMProvider(ABC):
    """Vendor-neutral LLM provider; vendor translation belongs in mappers.py.

    Credentials arrive through the constructor rather than the environment:
    they belong to an organisation, so one process serves many of them.
    """

    name: str
    capabilities: LLMCapabilities
    endpoint: str = ""

    def __init__(
        self,
        *,
        model: str = "",
        api_key: str = "",
        base_url: str = "",
        context_window: int = 0,
    ):
        self._model = model
        self._api_key = api_key
        self._base_url = self.normalize_endpoint(base_url)
        self._context_window = context_window

    def _get_model(self) -> str:
        return self._model

    @classmethod
    def normalize_endpoint(cls, base_url: str) -> str:
        endpoint = normalize_base_url(base_url)
        if cls.endpoint:
            if endpoint and endpoint != cls.endpoint:
                raise ValidationError(
                    {
                        "base_url": (
                            "This hosted provider only supports its fixed API endpoint."
                        )
                    }
                )
            return cls.endpoint
        return endpoint

    def _get_headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._api_key}"} if self._api_key else {}

    def _require_api_key(self):
        if not self._api_key:
            raise LLMProviderError(
                "An API key is required. Add one in Settings → AI Models."
            )

    def _response_error(self, status_code: int, body: bytes = b"") -> LLMProviderError:
        return status_error(status_code)

    def _catalog_deadline(self) -> float:
        return monotonic() + min(30, int(EnvVariable.AGENT_REQUEST_TIMEOUT.value))

    @staticmethod
    def _catalog_remaining(deadline: float) -> float:
        remaining = deadline - monotonic()
        if remaining <= 0:
            raise LLMProviderError(
                "Model discovery timed out. Check connectivity and retry."
            )
        return remaining

    @safe_call
    def _request_json(
        self, method: str, path: str, *, deadline: float, **kwargs
    ) -> dict:
        """Read one response within the catalog's shared monotonic deadline."""
        return async_to_sync(self._read_catalog_response)(
            method, path, deadline=deadline, **kwargs
        )

    async def _read_catalog_response(
        self, method: str, path: str, *, deadline: float, **kwargs
    ) -> dict:
        remaining = self._catalog_remaining(deadline)
        # Read timeouts only measure inactivity. Cancellation also interrupts a
        # trickling body/header or a read waiting to fill its next chunk.
        async with (
            asyncio.timeout(remaining),
            httpx.AsyncClient(headers={"Accept-Encoding": "identity"}) as client,
        ):
            remaining = self._catalog_remaining(deadline)
            async with client.stream(
                method,
                f"{self._base_url}{path}",
                headers=self._get_headers(),
                timeout=httpx.Timeout(remaining, connect=min(10, remaining)),
                follow_redirects=False,
                **kwargs,
            ) as response:
                self._catalog_remaining(deadline)
                failed = response.status_code != 200
                if failed and response.status_code != 429:
                    raise self._response_error(response.status_code)
                max_bytes = ERROR_MAX_BODY_BYTES if failed else CATALOG_MAX_BODY_BYTES
                # Avoid an unbounded decompressor behind a small chunk size.
                encoding = response.headers.get("content-encoding", "identity")
                if encoding.lower() != "identity":
                    if failed:
                        raise self._response_error(response.status_code)
                    raise LLMProviderError(
                        "The provider ignored the uncompressed catalog request. "
                        "Check the endpoint or proxy configuration."
                    )
                length = response.headers.get("content-length")
                if length is not None and int(length) > max_bytes:
                    if failed:
                        raise self._response_error(response.status_code)
                    raise LLMProviderError("The provider model catalog is too large.")
                body = bytearray()
                async for chunk in response.aiter_raw(
                    chunk_size=min(CATALOG_READ_CHUNK_BYTES, max_bytes)
                ):
                    self._catalog_remaining(deadline)
                    if len(body) + len(chunk) > max_bytes:
                        if failed:
                            raise self._response_error(response.status_code)
                        raise LLMProviderError(
                            "The provider model catalog is too large."
                        )
                    body.extend(chunk)
                self._catalog_remaining(deadline)
                if failed:
                    raise self._response_error(response.status_code, bytes(body))
                payload = json.loads(body)
                self._catalog_remaining(deadline)
                if not isinstance(payload, dict) or "error" in payload:
                    raise LLMProviderError(
                        "The provider returned an invalid model catalog. "
                        "Check the endpoint and retry."
                    )
                return payload

    def _list_catalog(
        self,
        path: str,
        mapper: Callable[[dict], ModelCatalogPage],
        *,
        page_parameter: str = "",
        params: dict | None = None,
    ) -> list[LLMModel]:
        deadline = self._catalog_deadline()
        parameters = dict(params or {})
        models = {}
        seen_pages = set()
        for _ in range(20):
            page = mapper(
                self._request_json(
                    "GET", path, deadline=deadline, params=dict(parameters)
                )
            )
            models.update((model.id, model) for model in page.models)
            self._catalog_remaining(deadline)
            if not page.next_page:
                return sorted(models.values(), key=lambda model: model.id)
            if not page_parameter or page.next_page in seen_pages:
                break
            seen_pages.add(page.next_page)
            parameters[page_parameter] = page.next_page
        raise LLMProviderError(
            "The provider returned an incomplete model catalog. Retry later."
        )

    def list_models(self) -> list[LLMModel]:
        """Discover live models compatible with this adapter's tool protocol."""
        raise LLMProviderError("This provider does not support model discovery.")

    @abstractmethod
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
        """Yield a stream of canonical LLMEvents for one model turn.

        `cacheable_prefix` is the leading portion of `system_prompt` that is
        byte-identical across every turn of a run (the service catalog).
        Adapters whose vendor supports prompt caching should mark it as a cache
        breakpoint; the rest may ignore it, since it is already included in
        `system_prompt`.
        """
        raise NotImplementedError
