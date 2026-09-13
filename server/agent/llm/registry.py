from utils.encryption import decrypt_val

from .base import BaseLLMProvider


class LLMProviderRegistry:
    """Maps a provider name to its adapter class.

    Classes, not instances: credentials belong to an organisation, so a
    provider is built per run from the config that run resolved. A singleton
    registered at startup could only ever serve one set of credentials.
    """

    def __init__(self):
        self._providers: dict[str, type[BaseLLMProvider]] = {}

    def register(self, provider: type[BaseLLMProvider]) -> None:
        self._providers[provider.name] = provider

    def get(self, name: str) -> type[BaseLLMProvider]:
        if name not in self._providers:
            known = ", ".join(sorted(self._providers)) or "none"
            raise ValueError(
                f"LLM provider '{name}' is not registered. Available: {known}."
            )
        return self._providers[name]


llm_registry = LLMProviderRegistry()


def provider_from_credentials(
    *,
    provider: str,
    model: str,
    api_key: str = "",
    base_url: str = "",
    context_window: int = 0,
) -> BaseLLMProvider:
    """Build an adapter from plaintext credentials.

    Separate from `build_provider` so an unsaved form can be dialled before it
    is stored, without inventing a throwaway model instance.
    """
    return llm_registry.get(provider)(
        model=model,
        api_key=api_key,
        base_url=base_url,
        context_window=context_window,
    )


def build_provider(config) -> BaseLLMProvider:
    """Instantiate the adapter for an `organisations.LLMConfig`.

    The stored key is decrypted here and nowhere earlier, so plaintext exists
    only for the life of the provider.
    """
    return provider_from_credentials(
        provider=config.provider,
        model=config.model,
        api_key=decrypt_val(config.api_key) if config.api_key else "",
        base_url=config.base_url,
        context_window=config.context_window,
    )


def resolve_llm_config(project):
    """The config a run on `project` should use.

    A project may name its own; otherwise the organisation's default applies.
    Returns None when the organisation has configured nothing, which callers
    surface as a "no model configured" error rather than a provider failure.
    """
    if project.llm_config_id:
        return project.llm_config
    return project.organisation.llm_configs.filter(is_default=True).first()
