"""Tests for the backfill_global_id management command"""

from io import StringIO

import pytest
from django.core.management import call_command
from keycloak.exceptions import KeycloakGetError

from main.factories import UserFactory
from users.management.commands import backfill_global_id

pytestmark = pytest.mark.django_db


def run(*args):
    """Run the command and return its output"""
    out = StringIO()
    call_command("backfill_global_id", *args, stdout=out)
    return out.getvalue()


def test_backfill_links_unlinked_scim_users():
    """Unlinked rows get their external id as global_id; others are untouched"""
    unlinked = UserFactory.create_batch(3, global_id=None)
    linked = UserFactory.create()
    no_external_id = UserFactory.create(global_id=None, scim_external_id=None)
    blank_external_id = UserFactory.create(global_id=None, scim_external_id="")

    output = run("--batch-size", "2")

    for user in unlinked:
        user.refresh_from_db()
        assert user.global_id == user.scim_external_id
    linked_global_id = linked.global_id
    linked.refresh_from_db()
    assert linked.global_id == linked_global_id
    no_external_id.refresh_from_db()
    assert no_external_id.global_id is None
    blank_external_id.refresh_from_db()
    assert blank_external_id.global_id is None
    assert "Set global_id on 3 users; 0 conflicted" in output


def test_backfill_skips_external_id_held_by_another_user():
    """A row whose external id is another row's global_id is a fork, not a link"""
    original = UserFactory.create()
    fork = UserFactory.create(global_id=None, scim_external_id=original.global_id)

    output = run()

    fork.refresh_from_db()
    assert fork.global_id is None
    assert "Skipping 1 whose id is another user's global_id" in output
    assert f"needs merge: user_id={fork.id} " in output
    assert "Set global_id on 0 users" in output


@pytest.mark.parametrize("batch_size", ["1", "2"])
def test_backfill_skips_external_id_shared_by_unlinked_users(batch_size):
    """Two unlinked rows with one external id are both left for a merge"""
    first = UserFactory.create(global_id=None)
    second = UserFactory.create(global_id=None, scim_external_id=first.scim_external_id)
    other = UserFactory.create(global_id=None)

    output = run("--batch-size", batch_size)

    for user in (first, second):
        user.refresh_from_db()
        assert user.global_id is None
        assert f"needs merge: user_id={user.id} " in output
    other.refresh_from_db()
    assert other.global_id == other.scim_external_id
    assert "2 that share their id with another unlinked user" in output
    assert "Set global_id on 1 users; 0 conflicted" in output


def test_backfill_is_idempotent():
    """A second run finds nothing to do"""
    UserFactory.create_batch(2, global_id=None)

    run()
    output = run()

    assert output.startswith("0 users have no global_id")
    assert "Set global_id on 0 users; 0 conflicted" in output


def test_backfill_dry_run_writes_nothing():
    """--dry-run reports the candidates without linking them"""
    user = UserFactory.create(global_id=None)

    output = run("--dry-run")

    user.refresh_from_db()
    assert user.global_id is None
    assert output.startswith("1 users have no global_id")


def test_backfill_retries_conflicting_batch_row_by_row(mocker):
    """
    A batch that hits the unique constraint is rolled back and retried by row.

    The batch is selected without excluding a row whose id another user took,
    as happens when that write lands after the batch is selected.
    """
    first = UserFactory.create(global_id=None)
    holder = UserFactory.create()
    conflicting = UserFactory.create(global_id=None, scim_external_id=holder.global_id)
    last = UserFactory.create(global_id=None)
    mocker.patch.object(
        backfill_global_id,
        "linkable_users",
        side_effect=backfill_global_id.unlinked_users,
    )

    output = run("--batch-size", "3")

    for user in (first, last):
        user.refresh_from_db()
        assert user.global_id == user.scim_external_id
    conflicting.refresh_from_db()
    assert conflicting.global_id is None
    assert "Set global_id on 2 users; 1 conflicted" in output
    assert f"backfill_global_id_conflict: user_id={conflicting.id} " in output


def test_backfill_verify_sample(mocker):
    """--verify-sample reports external ids Keycloak doesn't know, writing nothing"""
    present, missing = UserFactory.create_batch(2, global_id=None)
    client = mocker.Mock()

    def get_user(external_id):
        if external_id == missing.scim_external_id:
            raise KeycloakGetError(error_message="not found", response_code=404)
        return {"id": external_id}

    client.get_user.side_effect = get_user
    mocker.patch.object(
        backfill_global_id.keycloak_api, "get_admin_client", return_value=client
    )

    output = run("--verify-sample", "5")

    assert "1 of 2 sampled external ids name a Keycloak user" in output
    assert f"not in Keycloak: user_id={missing.id}" in output
    present.refresh_from_db()
    assert present.global_id is None


def test_backfill_verify_sample_raises_other_keycloak_errors(mocker):
    """A Keycloak error other than 404 aborts the sample instead of counting"""
    UserFactory.create(global_id=None)
    client = mocker.Mock()
    client.get_user.side_effect = KeycloakGetError(
        error_message="forbidden", response_code=403
    )
    mocker.patch.object(
        backfill_global_id.keycloak_api, "get_admin_client", return_value=client
    )

    with pytest.raises(KeycloakGetError):
        run("--verify-sample", "1")
