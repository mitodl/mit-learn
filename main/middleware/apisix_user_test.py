"""Tests for apisix middleware."""

import json
from base64 import b64encode

import pytest
from django.contrib.auth.models import AnonymousUser

from main.middleware.apisix_user import ApisixUserMiddleware


@pytest.mark.django_db(transaction=True)
def test_get_request(mocker):
    """Test RemoteUserMiddleware is called with expected headers"""
    apisix_user_info = {
        "global_id": "123456",
        "preferred_username": "testuser",
        "email": "testuser@test.edu",
        "given_name": "test",
        "family_name": "user",
        "fullName": "test user fullname",
        "emailOptIn": 0,
    }
    mock_process_request = mocker.patch(
        "main.middleware.apisix_user.RemoteUserMiddleware.process_request"
    )
    mock_request = mocker.Mock(
        META={
            "HTTP_X_USERINFO": b64encode(json.dumps(apisix_user_info).encode()),
        },
        user=AnonymousUser(),
    )
    apisix_middleware = ApisixUserMiddleware(mocker.Mock())
    apisix_middleware.process_request(mock_request)
    mock_process_request.assert_called_once_with(mock_request)
    assert mock_request.META.get("REMOTE_USER") == {"username": "testuser"}
