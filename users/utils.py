"""Users utilities"""

from urllib.parse import urlencode

from django.conf import settings
from django.core import signing
from django.core.exceptions import ImproperlyConfigured
from django.urls import reverse


def _get_unsubscribe_signer():
    if not settings.UNSUBSCRIBE_SECRET_KEY:
        msg = "UNSUBSCRIBE_SECRET_KEY is not set"
        raise ImproperlyConfigured(msg)
    return signing.TimestampSigner(
        key=settings.UNSUBSCRIBE_SECRET_KEY,
        fallback_keys=settings.UNSUBSCRIBE_SECRET_KEY_FALLBACKS or [],
    )


def generate_unsubscribe_url(user) -> str:
    """Return a fully-qualified signed unsubscribe URL for the user."""
    uuid_str = str(user.get_or_generate_unsubscribe_uuid())
    token = _get_unsubscribe_signer().sign(uuid_str)
    path = reverse("users:v1:unsubscribe", kwargs={"token": token})
    return f"{settings.MITOL_API_BASE_URL}{path}"


def generate_unsubscribe_frontend_url(user) -> str:
    """Return the frontend unsubscribe URL, matching UnsubscribeView.get's redirect."""
    uuid_str = str(user.get_or_generate_unsubscribe_uuid())
    token = _get_unsubscribe_signer().sign(uuid_str)
    params = urlencode({"token": token})
    return f"{settings.APP_BASE_URL}/unsubscribe?{params}"


def unsign_unsubscribe_token(token: str) -> str | None:
    """Unsign and return the UUID string, or None if invalid."""
    try:
        return _get_unsubscribe_signer().unsign(token)
    except signing.BadSignature:
        return None
