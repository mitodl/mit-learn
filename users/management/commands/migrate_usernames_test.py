"""Tests for the migrate_usernames management command"""

from io import StringIO

import pytest
from django.core.management import call_command

from main.factories import UserFactory

pytestmark = pytest.mark.django_db


def _apply_and_get_usernames(*users):
    call_command("migrate_usernames", "--apply", stdout=StringIO())
    for user in users:
        user.refresh_from_db()
    return [user.username for user in users]


@pytest.mark.parametrize(
    "username",
    ["jdoe", "John.Doe@example.com"],
)
def test_migrate_usernames_sets_lowercased_email(username):
    """A handle, or the email in another case, becomes the lowercased email"""
    user = UserFactory.create(username=username, email="John.Doe@example.com")

    assert _apply_and_get_usernames(user) == ["john.doe@example.com"]


def test_migrate_usernames_skips_blank_email():
    """A user with no email keeps their username"""
    user = UserFactory.create(username="jdoe", email="")

    assert _apply_and_get_usernames(user) == ["jdoe"]


def test_migrate_usernames_skips_email_longer_than_username():
    """An email that doesn't fit the username column is left alone"""
    user = UserFactory.create(username="jdoe", email=f"{'a' * 140}@example.com")

    assert _apply_and_get_usernames(user) == ["jdoe"]


def test_migrate_usernames_skips_shared_email():
    """Users who share an email, ignoring case, keep their usernames"""
    first = UserFactory.create(username="jdoe", email="shared@example.com")
    second = UserFactory.create(username="john", email="SHARED@example.com")

    assert _apply_and_get_usernames(first, second) == ["jdoe", "john"]


@pytest.mark.parametrize("taken", ["taken@example.com", "TAKEN@example.com"])
def test_migrate_usernames_skips_email_taken_as_username(taken):
    """A user whose email is another user's username keeps their username"""
    user = UserFactory.create(username="jdoe", email="taken@example.com")
    # a blank email keeps the other user's username where it is
    other = UserFactory.create(username=taken, email="")

    assert _apply_and_get_usernames(user, other) == ["jdoe", taken]


def test_migrate_usernames_follows_a_chain():
    """A user blocked by another user's old username is updated once it moves"""
    first = UserFactory.create(username="jdoe", email="next@example.com")
    second = UserFactory.create(username="next@example.com", email="last@example.com")

    assert _apply_and_get_usernames(first, second) == [
        "next@example.com",
        "last@example.com",
    ]


def test_migrate_usernames_dry_run_changes_nothing():
    """Without --apply, the command reports and leaves usernames alone"""
    user = UserFactory.create(username="jdoe", email="jdoe@example.com")
    UserFactory.create(username="jane", email="shared@example.com")
    UserFactory.create(username="janet", email="shared@example.com")
    out = StringIO()

    call_command("migrate_usernames", stdout=out)

    user.refresh_from_db()
    assert user.username == "jdoe"
    assert "3 users have a username" in out.getvalue()
    assert "1 of them can be renamed now" in out.getvalue()


def test_migrate_usernames_lists_users_left_for_review():
    """--apply reports how many it renamed and the ids it couldn't rename"""
    UserFactory.create(username="jdoe", email="jdoe@example.com")
    first = UserFactory.create(username="jane", email="shared@example.com")
    second = UserFactory.create(username="janet", email="shared@example.com")
    out = StringIO()

    call_command("migrate_usernames", "--apply", stdout=out)

    assert "Renamed 1 users" in out.getvalue()
    assert "2 users need manual review, because their email is shared" in (
        out.getvalue()
    )
    assert f"{first.pk}, {second.pk}" in out.getvalue()
