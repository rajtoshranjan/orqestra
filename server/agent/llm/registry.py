from orqestra.env_variables import EnvVariable

from .base import BaseLLMProvider


class LLMProviderRegistry:
    def __init__(self):
        self._providers: dict[str, BaseLLMProvider] = {}

    def register(self, provider: BaseLLMProvider) -> None:
        self._providers[provider.name] = provider

    def get(self, name: str) -> BaseLLMProvider:
        if name not in self._providers:
            raise ValueError(f"LLM provider '{name}' is not registered.")
        return self._providers[name]


llm_registry = LLMProviderRegistry()


def get_active_provider() -> BaseLLMProvider:
    return llm_registry.get(EnvVariable.AGENT_LLM_PROVIDER.value)
