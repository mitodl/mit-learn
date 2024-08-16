"""Tests for the utility views"""

import uuid


def test_anon_error(client, mocker):
    """Test that we get an error as we expect from a nonsense URL with an anonymous session."""

    response = client.get(f"/{uuid.uuid4()}")

    # Silk tends to grab bad URLs and then complains because there's no credentials..
    assert response.status_code == 403


def test_authed_error(user_client, mocker):
    """Test that we get an error as we expect from a nonsense URL with a session."""

    response = user_client.get(f"/{uuid.uuid4()}")

    assert response.status_code == 404
