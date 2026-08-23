from abc import ABC, abstractmethod
from collections.abc import Iterator

from .types import LLMCapabilities, LLMEvent, LLMMessage, ToolSpec


class BaseLLMProvider(ABC):
    """Vendor-neutral LLM provider. Adapters translate to/from their SDK here
    and nowhere else, so the engine never depends on a specific vendor."""

    name: str
    capabilities: LLMCapabilities

    @abstractmethod
    def stream(
        self,
        *,
        system_prompt: str,
        messages: list[LLMMessage],
        tools: list[ToolSpec],
        temperature: float = 0.0,
        max_tokens: int = 4096,
    ) -> Iterator[LLMEvent]:
        """Yield a stream of canonical LLMEvents for one model turn."""
        raise NotImplementedError
