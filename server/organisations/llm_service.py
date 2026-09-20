from dataclasses import asdict

from agent.llm.errors import safe_provider_error
from agent.llm.registry import provider_from_credentials
from agent.llm.types import LLMMessage, Role, Stop, TextBlock
from orqestra.exceptions.api import LLMProviderError
from utils.encryption import decrypt_val


def _build_provider(data):
    source = data.get("config")
    key = data.get("api_key") or (
        decrypt_val(source.api_key) if source and source.api_key else ""
    )
    return provider_from_credentials(
        provider=data["provider"],
        model=data.get("model", ""),
        api_key=key,
        base_url=data["base_url"],
        context_window=data.get("context_window", 0),
    )


def discover_models(data):
    """Only validated, org-scoped credentials reach this boundary."""
    try:
        provider = _build_provider(data)
        models = [asdict(model) for model in provider.list_models()]
        # Even a custom endpoint must not reflect the credential in its catalog.
        if provider._api_key and any(
            provider._api_key in value for model in models for value in model.values()
        ):
            raise LLMProviderError("The provider returned an invalid model catalog.")
        return {"ok": True, "models": models}
    except Exception as error:
        return {"ok": False, "error": str(safe_provider_error(error))}


def test_connection(data):
    try:
        provider = _build_provider(data)
        stopped = False
        for event in provider.stream(
            system_prompt="Reply with the single word: ok.",
            messages=[LLMMessage(role=Role.USER, content=[TextBlock(text="ping")])],
            tools=[],
            max_tokens=16,
        ):
            stopped = stopped or isinstance(event, Stop)
        if not stopped:
            raise LLMProviderError(
                "The provider ended the response unexpectedly. "
                "Retry the connection test."
            )
    except Exception as error:
        return {"ok": False, "error": str(safe_provider_error(error))}
    return {"ok": True, "model": data["model"]}
