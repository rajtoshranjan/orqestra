from enum import Enum


class OrganisationMemberRole(Enum):
    ADMIN = "admin"
    REGULAR = "regular"
    GUEST = "guest"

    @classmethod
    def choices(cls):
        return [(key.value, key.name) for key in cls]


class LLMProviderChoice(Enum):
    """Providers the agent has an adapter for (see server/agent/llm/)."""

    ANTHROPIC = "anthropic"
    GEMINI = "gemini"
    OLLAMA = "ollama"
    OPENAI = "openai"

    @classmethod
    def choices(cls):
        return [(key.value, key.name) for key in cls]


# Providers that authenticate with an API key. Ollama against a local endpoint
# needs none, so its key is optional.
LLM_PROVIDERS_REQUIRING_KEY = frozenset(
    {
        LLMProviderChoice.ANTHROPIC.value,
        LLMProviderChoice.GEMINI.value,
        LLMProviderChoice.OPENAI.value,
    }
)

# Providers that are reached at an operator-supplied address rather than a
# fixed vendor endpoint.
LLM_PROVIDERS_REQUIRING_BASE_URL = frozenset({LLMProviderChoice.OLLAMA.value})
