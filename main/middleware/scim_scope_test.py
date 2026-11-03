"""Tests for SCIMScopeCheckMiddleware"""

from datetime import timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from django.http import HttpResponse
from django.urls import reverse
from django.utils import timezone
from oauth2_provider.models import AccessToken
from oauth2_provider.scopes import get_scopes_backend

from main.factories import UserFactory
from main.middleware.scim_scope import SCIM_SCOPE, SCIMScopeCheckMiddleware

pytestmark = pytest.mark.django_db


def _token(user, scope=SCIM_SCOPE, expires_in=timedelta(hours=1)):
    return AccessToken.objects.create(
        user=user,
        token=uuid4().hex,
        scope=scope,
        expires=timezone.now() + expires_in,
    )


@pytest.fixture
def scim_url():
    """Return the SCIM Users endpoint"""
    return reverse("scim:root") + "Users"


@pytest.mark.parametrize(
    ("scope", "expires_in", "expected"),
    [
        ("", timedelta(hours=1), 401),
        ("read write", timedelta(hours=1), 401),
        ("read scim", timedelta(hours=-1), 401),
        ("read scim", timedelta(hours=1), 200),
    ],
)
def test_scim_paths_require_valid_scim_token(
    client, scim_url, scope, expires_in, expected
):
    """SCIM paths need an unexpired token with the scim scope"""
    token = _token(UserFactory.create(is_staff=True), scope, expires_in)
    response = client.get(scim_url, HTTP_AUTHORIZATION=f"Bearer {token.token}")
    assert response.status_code == expected


def test_scim_path_without_token(client, scim_url):
    """A logged-in staff user without a token is rejected"""
    client.force_login(UserFactory.create(is_staff=True))
    assert client.get(scim_url).status_code == 401


@pytest.mark.parametrize("expired", [False, True])
def test_logged_in_staff_cannot_borrow_token(client, scim_url, expired):
    """A session user can't pass with someone else's or an expired scim token"""
    staff = UserFactory.create(is_staff=True)
    if expired:
        token = _token(staff, expires_in=timedelta(hours=-1))
    else:
        token = _token(UserFactory.create(is_staff=True))
    client.force_login(staff)
    response = client.get(scim_url, HTTP_AUTHORIZATION=f"Bearer {token.token}")
    assert response.status_code == 401


def test_non_scim_paths_ignored():
    """Other paths pass through regardless of token"""
    request = SimpleNamespace(path="/api/v1/courses/")
    middleware = SCIMScopeCheckMiddleware(lambda _: HttpResponse(status=200))
    assert middleware(request).status_code == 200


def test_scim_scope_not_granted_by_default():
    """A token requested without scopes must not get scim"""
    backend = get_scopes_backend()
    assert SCIM_SCOPE in backend.get_all_scopes()
    assert SCIM_SCOPE not in backend.get_default_scopes()
