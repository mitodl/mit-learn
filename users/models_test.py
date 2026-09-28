"""Tests for users.models"""

import pytest

from main.factories import UserFactory


@pytest.mark.django_db
def test_get_or_generate_unsubscribe_uuid_returns_existing():
    """Returns the existing UUID without saving when one is already set."""
    user = UserFactory.create()
    original_uuid = user.unsubscribe_uuid
    assert original_uuid is not None

    result = user.get_or_generate_unsubscribe_uuid()

    user.refresh_from_db()
    assert result == original_uuid
    assert user.unsubscribe_uuid == original_uuid


@pytest.mark.django_db
def test_get_or_generate_unsubscribe_uuid_generates_and_persists():
    """Generates a new UUID and persists it when unsubscribe_uuid is None."""
    user = UserFactory.create()
    user.unsubscribe_uuid = None
    user.save(update_fields=["unsubscribe_uuid"])

    result = user.get_or_generate_unsubscribe_uuid()

    assert result is not None
    user.refresh_from_db()
    assert user.unsubscribe_uuid == result


@pytest.mark.django_db
def test_get_or_generate_unsubscribe_uuid_stable_on_repeated_calls():
    """Returns the same UUID on repeated calls."""
    user = UserFactory.create()
    user.unsubscribe_uuid = None
    user.save(update_fields=["unsubscribe_uuid"])

    first = user.get_or_generate_unsubscribe_uuid()
    second = user.get_or_generate_unsubscribe_uuid()

    assert first == second
