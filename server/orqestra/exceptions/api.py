from rest_framework import status
from rest_framework.exceptions import APIException


class LLMProviderError(APIException):
    """A safe, locally authored provider failure, never a vendor response body."""

    status_code = status.HTTP_502_BAD_GATEWAY
    default_detail = (
        "The model provider request failed. Check the API key, model access and "
        "endpoint in Settings → AI Models, then retry."
    )
    default_code = "llm_provider_error"


class Conflict(APIException):
    """Raised when a request conflicts with the current resource state (HTTP 409)."""

    status_code = status.HTTP_409_CONFLICT
    default_detail = "The request conflicts with the current state of the resource."
    default_code = "conflict"
