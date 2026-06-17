from django.apps import AppConfig


class AgentConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "agent"

    def ready(self):
        # Register LLM providers on startup. Import here to avoid app-registry
        # import-time issues.
        from .llm.anthropic_provider import AnthropicProvider
        from .llm.gemini_provider import GeminiProvider
        from .llm.registry import llm_registry

        llm_registry.register(AnthropicProvider())
        llm_registry.register(GeminiProvider())
