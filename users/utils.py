"""Users utilities"""

from django.conf import settings
from django.core import signing
from django.urls import reverse


def _get_unsubscribe_signer():
    return signing.TimestampSigner(
        key=settings.UNSUBSCRIBE_SECRET_KEY,
        fallback_keys=settings.UNSUBSCRIBE_SECRET_KEY_FALLBACKS or [],
    )


def generate_unsubscribe_url(user) -> str:
    """Return a fully-qualified signed unsubscribe URL for the user."""
    uuid_str = str(user.get_or_generate_unsubscribe_uuid())
    token = _get_unsubscribe_signer().sign(uuid_str)
    path = reverse("users:unsubscribe", kwargs={"token": token})
    return f"{settings.MITOL_API_BASE_URL}{path}"


def unsign_unsubscribe_token(token: str) -> str | None:
    """Unsign and return the UUID string, or None if invalid/expired."""
    try:
        return _get_unsubscribe_signer().unsign(
            token, max_age=settings.MITOL_UNSUBSCRIBE_TOKEN_MAX_AGE_SECONDS
        )
    except signing.BadSignature:
        return None
