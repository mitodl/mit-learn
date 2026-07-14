"""Tests for users.utils"""

import pytest

from main.factories import UserFactory
from users.utils import (
    _get_unsubscribe_signer,
    generate_unsubscribe_url,
    unsign_unsubscribe_token,
)


@pytest.mark.django_db
def test_generate_unsubscribe_url_raw_uuid_not_standalone(settings):
    """The raw UUID must not appear as a standalone path segment in the URL."""
    settings.MITOL_API_BASE_URL = "https://api.example.com"
    user = UserFactory.create()
    url = generate_unsubscribe_url(user)
    # The token embeds the UUID but also carries a timestamp+signature, so the
    # bare UUID is never a standalone path segment that could be used without
    # knowing the secret key.
    from urllib.parse import urlparse

    segments = urlparse(url).path.strip("/").split("/")
    assert str(user.unsubscribe_uuid) not in segments


@pytest.mark.django_db
def test_generate_unsubscribe_url_rooted_at_api_base(settings):
    """generate_unsubscribe_url should use MITOL_API_BASE_URL as the base."""
    settings.MITOL_API_BASE_URL = "https://api.example.com"
    user = UserFactory.create()
    url = generate_unsubscribe_url(user)
    assert url.startswith("https://api.example.com")


@pytest.mark.django_db
def test_generate_unsubscribe_url_token_can_recover_uuid(settings):
    """The token in the URL should unsign to the original UUID."""
    settings.MITOL_API_BASE_URL = "https://api.example.com"
    user = UserFactory.create()
    url = generate_unsubscribe_url(user)
    # token is the last non-empty path segment
    token = url.rstrip("/").rsplit("/", 1)[-1]
    recovered = unsign_unsubscribe_token(token)
    assert recovered == str(user.unsubscribe_uuid)


@pytest.mark.django_db
def test_unsign_unsubscribe_token_valid():
    """unsign_unsubscribe_token returns the UUID string for a valid token."""
    user = UserFactory.create()
    uuid_str = str(user.unsubscribe_uuid)
    token = _get_unsubscribe_signer().sign(uuid_str)
    assert unsign_unsubscribe_token(token) == uuid_str


def test_unsign_unsubscribe_token_tampered():
    """unsign_unsubscribe_token returns None for a tampered token."""
    assert unsign_unsubscribe_token("tampered:token:value") is None


def test_unsign_unsubscribe_token_invalid():
    """unsign_unsubscribe_token returns None for a completely invalid value."""
    assert unsign_unsubscribe_token("not-a-token") is None


@pytest.mark.django_db
def test_unsign_unsubscribe_token_expired(settings):
    """unsign_unsubscribe_token returns None for an expired token."""
    settings.MITOL_UNSUBSCRIBE_TOKEN_MAX_AGE_SECONDS = 0
    user = UserFactory.create()
    uuid_str = str(user.unsubscribe_uuid)
    token = _get_unsubscribe_signer().sign(uuid_str)
    assert unsign_unsubscribe_token(token) is None
