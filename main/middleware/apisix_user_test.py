"""Tests for apisix middleware."""

import json
from base64 import b64encode
from uuid import uuid4

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.db import close_old_connections

from main.factories import UserFactory
from main.middleware.apisix_user import ApisixUserMiddleware

User = get_user_model()

apisix_user_info = {
    "sub": uuid4().hex,
    "preferred_username": "testuser",
    "email": "testuser@test.edu",
    "given_name": "test",
    "family_name": "user",
    "name": "test user fullname",
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
    mocker.patch("main.middleware.apisix_user.Posthog", mocker.Mock(
        capture=mocker.ANY,
    ))
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
    assert user.profile.name == apisix_user_info["name"]
    assert user.profile.email_optin == apisix_user_info["emailOptIn"]
    assert user.global_id == apisix_user_info["sub"]


@pytest.mark.django_db(transaction=True)
def test_get_request_existing_user_no_globalid(mocker, mock_login):
    """Test that a valid request updates existing user with same email, no global_id."""
    close_old_connections()
    user = UserFactory.create(email=apisix_user_info["email"], global_id=None)
    mock_request = mocker.Mock(
        META={
            "HTTP_X_USERINFO": b64encode(json.dumps(apisix_user_info).encode()),
        },
        user=AnonymousUser(),
    )
    apisix_middleware = ApisixUserMiddleware(mocker.Mock())
    apisix_middleware.process_request(mock_request)
    mock_login.assert_called_once()
    user.refresh_from_db()
    assert user.username == apisix_user_info["preferred_username"]
    assert user.email == apisix_user_info["email"]
    assert user.global_id == apisix_user_info["sub"]


@pytest.mark.django_db(transaction=True)
def test_get_request_existing_user_with_global_id_diff_email(mocker, mock_login):
    """Test that a valid request updates email of user with same global_id"""
    close_old_connections()
    user = UserFactory.create(
        email="old_email@test.edu", global_id=apisix_user_info["sub"]
    )
    mock_request = mocker.Mock(
        META={
            "HTTP_X_USERINFO": b64encode(json.dumps(apisix_user_info).encode()),
        },
        user=AnonymousUser(),
    )
    apisix_middleware = ApisixUserMiddleware(mocker.Mock())
    apisix_middleware.process_request(mock_request)
    user.refresh_from_db()
    assert user.username == apisix_user_info["preferred_username"]
    assert user.global_id == apisix_user_info["sub"]
    assert user.email == apisix_user_info["email"]


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("same_user", [False, True])
def test_get_request_different_user_logout(mocker, client, same_user):
    """Test that a request with mismatched users logs user out"""
    other_user = UserFactory.create()
    api_sixuser = UserFactory.create(
        username=apisix_user_info["preferred_username"],
        global_id=apisix_user_info["sub"],
        email=apisix_user_info["email"],
    )
    client.force_login(api_sixuser if same_user else other_user)
    mock_request = mocker.Mock(
        META={
            "HTTP_X_USERINFO": b64encode(json.dumps(apisix_user_info).encode()),
        },
        user=(api_sixuser if same_user else other_user),
    )
    mocker.patch("main.middleware.apisix_user.login")
    mock_logout = mocker.patch("main.middleware.apisix_user.logout")
    apisix_middleware = ApisixUserMiddleware(mocker.Mock())
    apisix_middleware.process_request(mock_request)
    assert mock_logout.call_count == (0 if same_user else 1)


@pytest.mark.django_db(transaction=True)
def test_get_request_logged_in_no_header(mocker, client, user):
    """Test that an authenticated user without apisix header gets logged out."""
    close_old_connections()
    client.force_login(user)
    mock_request = mocker.Mock(
        META={},
        user=user,
    )
    mock_logout = mocker.patch("main.middleware.apisix_user.logout")
    apisix_middleware = ApisixUserMiddleware(mocker.Mock())
    apisix_middleware.process_request(mock_request)
    mock_logout.assert_called_once()
