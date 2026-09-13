from abc import ABC, abstractmethod
from collections.abc import Iterator

from .types import LLMCapabilities, LLMEvent, LLMMessage, ToolSpec


class BaseLLMProvider(ABC):
    """Vendor-neutral LLM provider. Adapters translate to/from their SDK here
    and nowhere else, so the engine never depends on a specific vendor.

    Credentials arrive through the constructor rather than the environment:
    they belong to an organisation, so one process serves many of them.
    """

    name: str
    capabilities: LLMCapabilities

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
        self._base_url = base_url
        self._context_window = context_window

    def _get_model(self) -> str:
        return self._model

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
