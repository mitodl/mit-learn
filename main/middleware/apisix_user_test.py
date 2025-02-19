"""Tests for apisix middleware."""

import json
from base64 import b64encode

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.db import close_old_connections

from main.factories import UserFactory
from main.middleware.apisix_user import ApisixUserMiddleware

User = get_user_model()

apisix_user_info = {
    "global_id": "123456",
    "preferred_username": "testuser",
    "email": "testuser@test.edu",
    "given_name": "test",
    "family_name": "user",
    "fullName": "test user fullname",
    "emailOptIn": 0,
}


@pytest.fixture
def mock_login(mocker):
    """Mock the login function."""
    return mocker.patch("main.middleware.apisix_user.login")


@pytest.fixture(autouse=True)
def setup_test_database():
    """
    Ensure clean database state for each test.
    Avoids a strange database wrapper error.
    """
    close_old_connections()


@pytest.mark.django_db(transaction=True)
def test_get_request(mocker, mock_login):
    """Test that a valid request creates a new user."""
    close_old_connections()
    mock_request = mocker.Mock(
        META={
            "HTTP_X_USERINFO": b64encode(json.dumps(apisix_user_info).encode()),
        },
        user=AnonymousUser(),
    )
    apisix_middleware = ApisixUserMiddleware(mocker.Mock())
    apisix_middleware.process_request(mock_request)
    mock_login.assert_called_once()
    user = User.objects.get(email=apisix_user_info["email"])
    assert user.username == apisix_user_info["preferred_username"]
    assert user.first_name == apisix_user_info["given_name"]
    assert user.last_name == apisix_user_info["family_name"]
    assert user.profile.name == apisix_user_info["fullName"]
    assert user.profile.email_optin == apisix_user_info["emailOptIn"]


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("authenticated", [False, True])
def test_get_request_missing_key(mocker, client, authenticated):
    """Test that a request with missing header forces a logout if user is authenticated"""
    if authenticated:
        user = UserFactory.create(
            username=apisix_user_info["preferred_username"],
            email=apisix_user_info["email"],
        )
        client.force_login(user)
    else:
        user = AnonymousUser()
    assert user.is_authenticated == authenticated
    mock_request = mocker.Mock(
        META={
            "HTTP_X_OOPS": b64encode(json.dumps(apisix_user_info).encode()),
        },
        user=user,
    )
    mock_logout = mocker.patch("main.middleware.apisix_user.logout")
    apisix_middleware = ApisixUserMiddleware(mocker.Mock())
    apisix_middleware.force_logout_if_no_header = True
    apisix_middleware.process_request(mock_request)
    assert mock_logout.call_count == (1 if authenticated else 0)
