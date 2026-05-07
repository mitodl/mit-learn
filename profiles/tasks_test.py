"""Tests for profile tasks."""

import pytest

from main.factories import UserFactory
from profiles.tasks import send_welcome_email


@pytest.mark.django_db
def test_send_welcome_email_sends_template_email(mocker):
    """send_welcome_email should send rendered welcome template for valid user."""
    user = UserFactory.create(email="new.user@example.com", first_name="New")
    user.profile.name = "Full Name"
    user.profile.save()
    mocked_send = mocker.patch("profiles.tasks.send_template_email")

    send_welcome_email(user.id)

    mocked_send.assert_called_once_with(
        ["new.user@example.com"],
        "MIT Learn - Welcome to MIT Learn",
        "email/welcome_email.html",
        context={"display_name": "Full Name"},
    )


@pytest.mark.django_db
def test_send_welcome_email_missing_user(mocker):
    """send_welcome_email should no-op when user does not exist."""
    mocked_send = mocker.patch("profiles.tasks.send_template_email")

    send_welcome_email(999999)

    mocked_send.assert_not_called()


@pytest.mark.django_db
def test_send_welcome_email_blank_email(mocker):
    """send_welcome_email should no-op when user has blank email."""
    user = UserFactory.create(email="")
    mocked_send = mocker.patch("profiles.tasks.send_template_email")

    send_welcome_email(user.id)

    mocked_send.assert_not_called()


@pytest.mark.django_db
def test_send_welcome_email_uses_full_name_when_profile_name_missing(mocker):
    """Falls back to first+last name if profile.name is missing."""
    user = UserFactory.create(
        email="full.name@example.com",
        first_name="Full",
        last_name="Name",
    )
    user.profile.name = None
    user.profile.save()
    mocked_send = mocker.patch("profiles.tasks.send_template_email")

    send_welcome_email(user.id)

    mocked_send.assert_called_once_with(
        ["full.name@example.com"],
        "MIT Learn - Welcome to MIT Learn",
        "email/welcome_email.html",
        context={"display_name": "Full Name"},
    )


@pytest.mark.django_db
def test_send_welcome_email_uses_username_when_names_missing(mocker):
    """Falls back to username when profile/full name are not available."""
    user = UserFactory.create(
        email="username.only@example.com",
        first_name="",
        last_name="",
        username="username-only",
    )
    user.profile.name = None
    user.profile.save()
    mocked_send = mocker.patch("profiles.tasks.send_template_email")

    send_welcome_email(user.id)

    mocked_send.assert_called_once_with(
        ["username.only@example.com"],
        "MIT Learn - Welcome to MIT Learn",
        "email/welcome_email.html",
        context={"display_name": "username-only"},
    )


@pytest.mark.django_db
def test_send_welcome_email_uses_generic_greeting_when_name_and_username_missing(
    mocker,
):
    """Falls back to a generic greeting when no user-identifying name exists."""
    user = UserFactory.create(
        email="generic.greeting@example.com",
        first_name="",
        last_name="",
        username="",
    )
    user.profile.name = None
    user.profile.save()
    mocked_send = mocker.patch("profiles.tasks.send_template_email")

    send_welcome_email(user.id)

    mocked_send.assert_called_once_with(
        ["generic.greeting@example.com"],
        "MIT Learn - Welcome to MIT Learn",
        "email/welcome_email.html",
        context={"display_name": "there"},
    )
