from functools import wraps

import httpx
import requests
from orqestra.exceptions.api import LLMProviderError


def status_error(status_code: int) -> LLMProviderError:
    if status_code in (401, 403):
        message = (
            "The provider rejected the API key or access permissions (401/403). "
            "Check the key and model access in Settings → AI Models."
        )
    elif status_code == 429:
        message = (
            "The provider rate limit or quota was reached (429). "
            "Check billing and retry later."
        )
    elif status_code == 404:
        message = (
            "The provider endpoint or model was not found (404). "
            "Check the endpoint and model access."
        )
    elif 300 <= status_code < 400:
        message = (
            "The provider redirected the request. Use its direct endpoint; "
            "credentials are never forwarded to redirects."
        )
    elif status_code >= 500:
        message = "The provider is temporarily unavailable. Retry later."
    else:
        message = (
            "The provider rejected the request. Check the model supports tool "
            "calling and the endpoint is correct."
        )
    return LLMProviderError(message)


def safe_provider_error(error: Exception) -> LLMProviderError:
    """Never interpolate SDK exceptions: they can contain keys, URLs and bodies."""
    if isinstance(error, LLMProviderError):
        return error
    status_code = getattr(error, "status_code", None)
    if not isinstance(status_code, int):
        status_code = getattr(error, "code", None)
    if not isinstance(status_code, int):
        response = getattr(error, "response", None)
        status_code = getattr(response, "status_code", None)
    if isinstance(status_code, int):
        return status_error(status_code)
    if isinstance(error, (requests.Timeout, httpx.TimeoutException, TimeoutError)):
        return LLMProviderError("The provider timed out. Check connectivity and retry.")
    if isinstance(error, (requests.ConnectionError, httpx.ConnectError)):
        return LLMProviderError(
            "Cannot reach the provider. Check the endpoint is reachable from the "
            "server container and that the model server is running."
        )
    return LLMProviderError()


def safe_call(call):
    @wraps(call)
    def wrapped(*args, **kwargs):
        try:
            return call(*args, **kwargs)
        except Exception as error:
            raise safe_provider_error(error) from None

    return wrapped


def safe_stream(stream):
    @wraps(stream)
    def wrapped(*args, **kwargs):
        try:
            yield from stream(*args, **kwargs)
        except Exception as error:
            raise safe_provider_error(error) from None

    return wrapped
