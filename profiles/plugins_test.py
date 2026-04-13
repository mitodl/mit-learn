"""Tests for profiles plugins."""

import pytest

from main.factories import UserFactory
from profiles.plugins import WelcomeEmailPlugin


@pytest.mark.django_db
def test_welcome_email_plugin_user_created(mocker):
    """WelcomeEmailPlugin should queue welcome email task on user creation."""
    user = UserFactory.create(email="new.user@example.com", first_name="New")
    mocked_delay = mocker.patch("profiles.plugins.send_welcome_email.delay")

    WelcomeEmailPlugin().user_created(user, user_data={})

    mocked_delay.assert_called_once_with(user.id)
