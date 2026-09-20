from urllib.parse import urlsplit, urlunsplit

from rest_framework.exceptions import ValidationError


INVALID_ENDPOINT = (
    "Use an absolute http:// or https:// base URL without credentials, "
    "query parameters or fragments."
)


def normalize_base_url(value: str) -> str:
    """Canonical credential destination; paths remain part of its identity."""
    if not value:
        return ""
    try:
        if any(character.isspace() or ord(character) < 32 for character in value):
            raise ValueError
        if any(character in value for character in ("\\", "?", "#", "%")):
            raise ValueError
        parts = urlsplit(value)
        if (
            parts.scheme not in {"http", "https"}
            or not parts.hostname
            or parts.username is not None
            or parts.password is not None
            or any(segment in {".", ".."} for segment in parts.path.split("/"))
        ):
            raise ValueError
        host = parts.hostname.encode("idna").decode("ascii").lower()
        if ":" in host:
            host = f"[{host}]"
        port = parts.port
        if port is not None and port != {"http": 80, "https": 443}[parts.scheme]:
            host = f"{host}:{port}"
        return urlunsplit((parts.scheme, host, parts.path.rstrip("/"), "", ""))
    except (ValueError, UnicodeError):
        raise ValidationError({"base_url": INVALID_ENDPOINT}) from None
