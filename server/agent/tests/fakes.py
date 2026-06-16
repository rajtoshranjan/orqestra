from collections.abc import Iterator

from agent.llm.base import BaseLLMProvider
from agent.llm.types import LLMCapabilities, LLMEvent


class FakeLLMProvider(BaseLLMProvider):
    """Yields pre-scripted turns. Each turn is a list of LLMEvents."""

    name = "fake"
    capabilities = LLMCapabilities()

    def __init__(self, scripted_turns: list[list[LLMEvent]]):
        self._turns = list(scripted_turns)
        self._index = 0
        self.calls: list[dict] = []

    def stream(self, *, system_prompt, messages, tools, temperature=0.0, max_tokens=4096) -> Iterator[LLMEvent]:
        self.calls.append({"system_prompt": system_prompt, "messages": messages, "tools": tools})
        turn = self._turns[self._index]
        self._index += 1
        yield from turn


class RecordingSink:
    """Captures (event_type, payload) tuples emitted by the engine."""

    def __init__(self):
        self.events: list[tuple[str, dict]] = []

    def __call__(self, event_type: str, payload: dict) -> None:
        self.events.append((event_type, payload))
