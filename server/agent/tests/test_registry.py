from collections.abc import Iterator

from django.test import SimpleTestCase, override_settings

from agent.llm.base import BaseLLMProvider
from agent.llm.registry import LLMProviderRegistry, get_active_provider, llm_registry
from agent.llm.types import LLMCapabilities, LLMEvent, LLMMessage, Stop, ToolSpec


class _StubProvider(BaseLLMProvider):
    name = "stub"
    capabilities = LLMCapabilities()

    def stream(self, *, system_prompt, messages, tools, temperature=0.0, max_tokens=4096) -> Iterator[LLMEvent]:
        yield Stop(reason="end_turn")


class RegistryTests(SimpleTestCase):
    def test_register_and_get(self):
        registry = LLMProviderRegistry()
        provider = _StubProvider()

        registry.register(provider)

        self.assertIs(registry.get("stub"), provider)

    def test_get_unknown_raises(self):
        registry = LLMProviderRegistry()

        with self.assertRaises(ValueError):
            registry.get("missing")

    @override_settings(AGENT_LLM_PROVIDER="stub")
    def test_get_active_provider_reads_settings(self):
        llm_registry.register(_StubProvider())

        self.assertEqual(get_active_provider().name, "stub")
