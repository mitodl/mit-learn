"""Tests for the backfill_global_id management command"""

from io import StringIO

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command

from main.factories import UserFactory

User = get_user_model()

pytestmark = pytest.mark.django_db


def run_command(*args):
    """Run the command and return its stdout"""
    out = StringIO()
    call_command("backfill_global_id", *args, stdout=out)
    return out.getvalue()


def test_check_reports_stats():
    """Check should break down users missing global_id by scim_external_id presence"""
    UserFactory.create_batch(2)
    UserFactory.create(global_id=None, scim_external_id="abc")
    UserFactory.create(global_id="", scim_external_id="def")
    UserFactory.create(global_id=None, scim_external_id=None)
    UserFactory.create(global_id=None, scim_external_id="")

    output = run_command("check")

    assert "Total users: 6" in output
    assert "Missing global_id: 4 (66.7% of all users)" in output
    assert "with scim_external_id: 2 (50.0% of those missing global_id)" in output
    assert "without scim_external_id: 2 (50.0% of those missing global_id)" in output
    assert "Fixable by the fix subcommand: 2" in output


def test_check_reports_conflicts():
    """Check should flag scim_external_ids that cannot be copied to global_id"""
    UserFactory.create(global_id="taken", scim_external_id="taken")
    conflicting = UserFactory.create(global_id=None, scim_external_id="taken")
    shared_one = UserFactory.create(global_id=None, scim_external_id="shared")
    UserFactory.create(global_id=None, scim_external_id="shared")
    UserFactory.create(global_id=None, scim_external_id="unique")

    output = run_command("check")

    assert "Fixable by the fix subcommand: 1" in output
    assert "Conflicting scim_external_ids: 3 user(s)" in output
    assert f"user {conflicting.id}: taken (already another user's global_id)" in output
    assert (
        f"user {shared_one.id}: shared (shared with another user missing a global_id)"
        in output
    )


def test_check_skip_conflicts():
    """Check should be able to skip the conflict pass"""
    UserFactory.create(global_id="taken", scim_external_id="taken")
    UserFactory.create(global_id=None, scim_external_id="taken")

    output = run_command("check", "--skip-conflicts")

    assert "at most 1" in output
    assert "Conflicting scim_external_ids" not in output


def test_fix_copies_scim_external_id():
    """Fix should copy scim_external_id to global_id for users missing one"""
    missing = UserFactory.create(global_id=None, scim_external_id="abc")
    blank = UserFactory.create(global_id="", scim_external_id="def")
    untouched = UserFactory.create(global_id="existing", scim_external_id="other")

    output = run_command("fix")

    missing.refresh_from_db()
    blank.refresh_from_db()
    untouched.refresh_from_db()
    assert missing.global_id == "abc"
    assert blank.global_id == "def"
    assert untouched.global_id == "existing"
    assert "Fixed 2 user(s)" in output
    assert "Users still missing global_id: 0" in output


def test_fix_skips_users_without_scim_external_id():
    """Fix should leave users with no scim_external_id alone"""
    no_scim = UserFactory.create(global_id=None, scim_external_id=None)
    blank_scim = UserFactory.create(global_id=None, scim_external_id="")

    output = run_command("fix")

    no_scim.refresh_from_db()
    blank_scim.refresh_from_db()
    assert no_scim.global_id is None
    assert blank_scim.global_id is None
    assert "Fixed 0 user(s)" in output
    assert "without scim_external_id: 2" in output


def test_fix_skips_conflicting_values():
    """Fix should not attempt updates that would violate the unique constraint"""
    UserFactory.create(global_id="taken", scim_external_id="taken")
    already_taken = UserFactory.create(global_id=None, scim_external_id="taken")
    shared_one = UserFactory.create(global_id=None, scim_external_id="shared")
    shared_two = UserFactory.create(global_id=None, scim_external_id="shared")
    fixable = UserFactory.create(global_id=None, scim_external_id="unique")

    output = run_command("fix")

    for user in (already_taken, shared_one, shared_two, fixable):
        user.refresh_from_db()
    assert already_taken.global_id is None
    assert shared_one.global_id is None
    assert shared_two.global_id is None
    assert fixable.global_id == "unique"
    assert "Fixed 1 user(s)" in output
    assert "Skipped 3 user(s) with a conflicting scim_external_id" in output


def test_fix_batches():
    """Fix should update every user even when batching"""
    users = [
        UserFactory.create(global_id=None, scim_external_id=f"scim-{index}")
        for index in range(5)
    ]

    output = run_command("fix", "--batch-size", "2")

    for user in users:
        user.refresh_from_db()
    assert [user.global_id for user in users] == [f"scim-{i}" for i in range(5)]
    assert "Fixed 5 user(s)" in output


def test_fix_batching_terminates_with_conflicts():
    """Skipped users should not stall the id cursor and re-run forever"""
    UserFactory.create(global_id="taken", scim_external_id="taken")
    conflicting = UserFactory.create_batch(3, global_id=None, scim_external_id="taken")
    fixable = UserFactory.create(global_id=None, scim_external_id="unique")

    output = run_command("fix", "--batch-size", "1")

    fixable.refresh_from_db()
    assert fixable.global_id == "unique"
    for user in conflicting:
        user.refresh_from_db()
        assert user.global_id is None
    assert "Fixed 1 user(s)" in output
    assert "Skipped 3 user(s)" in output


def test_fix_start_id():
    """Fix should resume from just after the given id"""
    first = UserFactory.create(global_id=None, scim_external_id="first")
    second = UserFactory.create(global_id=None, scim_external_id="second")

    output = run_command("fix", "--start-id", str(first.id))

    first.refresh_from_db()
    second.refresh_from_db()
    assert first.global_id is None
    assert second.global_id == "second"
    assert "Fixed 1 user(s)" in output


def test_fix_queries_scale_with_batches(django_assert_num_queries):
    """Fix should run a fixed number of queries per batch, not per user"""
    UserFactory.create_batch(6, global_id=None)

    # 1 select + 1 update per batch, 3 batches, plus the closing count
    with django_assert_num_queries(8):
        run_command("fix", "--batch-size", "2")
