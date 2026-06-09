import base64
import hashlib

from django.conf import settings
from cryptography.fernet import Fernet


def get_fernet() -> Fernet:
    """
    Derive a 32-byte key from SECRET_KEY and return a Fernet instance.
    """
    secret_key = settings.SECRET_KEY
    if isinstance(secret_key, str):
        secret_key = secret_key.encode()

    # Generate 32 bytes using SHA-256.
    key_bytes = hashlib.sha256(secret_key).digest()
    # Fernet expects base64 URL-safe encoded key.
    fernet_key = base64.urlsafe_b64encode(key_bytes)
    return Fernet(fernet_key)


def encrypt_val(val: str) -> str:
    """
    Encrypt a plaintext string and return a cipher string.
    """
    if not val:
        return ""
    try:
        f = get_fernet()
        return f.encrypt(val.encode()).decode()
    except Exception as exc:
        raise ValueError(f"Failed to encrypt value: {exc}")


def decrypt_val(val: str) -> str:
    """
    Decrypt an encrypted string and return plaintext.
    """
    if not val:
        return ""
    try:
        f = get_fernet()
        return f.decrypt(val.encode()).decode()
    except Exception as exc:
        raise ValueError(f"Failed to decrypt value: {exc}")
