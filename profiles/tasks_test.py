"""Tests for profile tasks."""

import pytest

from main.factories import UserFactory
from profiles.models import ProgramCertificate
from profiles.tasks import SyncProgramCertificatesTask, send_welcome_email


@pytest.mark.django_db
def test_send_welcome_email_sends_template_email(mocker):
    """send_welcome_email should send rendered welcome template for valid user."""
    user = UserFactory.create(email="new.user@example.com", first_name="New")
    user.profile.name = "Full Name"
    user.profile.save()
    mocked_send = mocker.patch("profiles.tasks.send_template_email")

    send_welcome_email(user.id)

    mocked_send.assert_called_once_with(
        user,
        "MIT Learn - Welcome to MIT Learn",
        "email/welcome_email.html",
        context={"display_name": "Full Name"},
        is_transactional=True,
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
        user,
        "MIT Learn - Welcome to MIT Learn",
        "email/welcome_email.html",
        context={"display_name": "Full Name"},
        is_transactional=True,
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
        user,
        "MIT Learn - Welcome to MIT Learn",
        "email/welcome_email.html",
        context={"display_name": "username-only"},
        is_transactional=True,
    )


@pytest.mark.django_db
def test_send_welcome_email_handles_missing_profile_relation(mocker):
    """Falls back cleanly when the reverse profile relation is missing."""
    user = UserFactory.create(
        email="missing.profile@example.com",
        first_name="",
        last_name="",
        username="profile-missing",
    )
    user.profile.delete()
    mocked_send = mocker.patch("profiles.tasks.send_template_email")

    send_welcome_email(user.id)

    mocked_send.assert_called_once_with(
        user,
        "MIT Learn - Welcome to MIT Learn",
        "email/welcome_email.html",
        context={"display_name": "profile-missing"},
        is_transactional=True,
    )


@pytest.mark.django_db
def test_sync_program_certificates_task_upserts_iterated_rows(mocker):
    """fetch_and_upsert calls upsert_program_certificate for every row
    iter_rows yields, and returns the row count.
    """
    rows = [
        {"record_hash": "a", "program_title": "Program A"},
        {"record_hash": "b", "program_title": "Program B"},
    ]
    mocker.patch("profiles.tasks.iter_rows", return_value=iter(rows))
    mocked_upsert = mocker.patch("profiles.tasks.upsert_program_certificate")

    count = SyncProgramCertificatesTask.fetch_and_upsert(conn=mocker.Mock())

    assert count == 2
    assert mocked_upsert.call_count == 2
    mocked_upsert.assert_any_call(rows[0])
    mocked_upsert.assert_any_call(rows[1])


def test_sync_program_certificates_task_view_name_is_fully_qualified():
    """view_name is a fully-qualified catalog.database.table name, per
    learning_resources.lib.warehouse.iter_rows's contract.
    """
    assert SyncProgramCertificatesTask.view_name == (
        "ol_data_lake_production.ol_warehouse_production_integrations"
        ".integrations__learn__program_certificates"
    )


@pytest.mark.django_db
def test_sync_program_certificates_task_does_not_prune(mocker):
    """A full_refresh run must never delete rows this pull didn't see —
    see profiles.etl.upsert_program_certificate's docstring.
    """
    ProgramCertificate.objects.create(record_hash="untouched", user_email="")
    mocker.patch(
        "profiles.tasks.iter_rows",
        return_value=iter([{"record_hash": "abc123"}]),
    )

    SyncProgramCertificatesTask.fetch_and_upsert(conn=mocker.Mock())

    assert ProgramCertificate.objects.filter(record_hash="untouched").exists()
