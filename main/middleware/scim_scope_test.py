"""Tests for SCIMScopeCheckMiddleware"""

from types import SimpleNamespace

import pytest
from django.http import HttpResponse
from django.urls import reverse
from oauth2_provider.scopes import get_scopes_backend

from main.middleware.scim_scope import SCIM_SCOPE, SCIMScopeCheckMiddleware


def _call(path, token):
    request = SimpleNamespace(path=path)
    if token is not None:
        request.access_token = token
    return SCIMScopeCheckMiddleware(lambda _: HttpResponse(status=200))(request)


@pytest.mark.parametrize(
    ("token", "expected"),
    [
        (None, 401),
        (SimpleNamespace(scope="read write"), 401),
        (SimpleNamespace(scope="read scim"), 200),
    ],
)
def test_scim_paths_require_scope(token, expected):
    """SCIM paths need a token with the scim scope"""
    assert _call(reverse("scim:root") + "Users", token).status_code == expected


def test_non_scim_paths_ignored():
    """Other paths pass through regardless of token"""
    assert _call("/api/v1/courses/", None).status_code == 200


def test_scim_scope_not_granted_by_default():
    """A token requested without scopes must not get scim"""
    backend = get_scopes_backend()
    assert SCIM_SCOPE in backend.get_all_scopes()
    assert SCIM_SCOPE not in backend.get_default_scopes()
