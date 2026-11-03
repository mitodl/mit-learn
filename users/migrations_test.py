"""Tests for the social-auth table cleanup in 0013_drop_social_auth_tables."""

import importlib

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, connection, transaction

from main.factories import UserFactory

pytestmark = pytest.mark.django_db

User = get_user_model()

MIGRATION = "0013_drop_social_auth_tables"

# The table social_django created, reduced to the columns that matter here.
# The foreign key matches what Django emits for models.ForeignKey on
# PostgreSQL, and what production actually has: NO ACTION, DEFERRABLE
# INITIALLY DEFERRED.
LEGACY_TABLE_DDL = """
CREATE TABLE social_auth_usersocialauth (
    id bigserial PRIMARY KEY,
    provider varchar(32) NOT NULL,
    uid varchar(255) NOT NULL,
    user_id integer NOT NULL,
    CONSTRAINT social_auth_usersocialauth_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users_user(id) DEFERRABLE INITIALLY DEFERRED
)
"""


def run_migration_sql():
    """Run 0013's own SQL, so these tests can't drift from the migration"""
    module = importlib.import_module(f"users.migrations.{MIGRATION}")
    (operation,) = module.Migration.operations
    with connection.cursor() as cursor:
        for statement in operation.sql:
            cursor.execute(statement)


def test_migration_is_applied():
    """0013 is in the graph and ran, and left no social_auth_* tables behind"""
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT count(*) FROM django_migrations WHERE app = 'users' AND name = %s",
            [MIGRATION],
        )
        assert cursor.fetchone()[0] == 1

        cursor.execute(
            "SELECT tablename FROM pg_tables "
            "WHERE schemaname = 'public' AND tablename LIKE 'social_auth%'"
        )
        assert cursor.fetchall() == []

        cursor.execute(
            "SELECT count(*) FROM django_migrations WHERE app = 'social_django'"
        )
        assert cursor.fetchone()[0] == 0


def test_user_delete_blocked_by_legacy_row_until_migration_runs():
    """
    Deleting a user with a leftover social_auth row fails until 0013 runs.

    Reproduces the upgrade path, which a fresh database does not exercise:
    social_django is gone from INSTALLED_APPS, so Django no longer collects
    the related row when cascading, but the database still enforces the
    foreign key.

    The constraint is deferred, so in production the violation surfaces when
    the delete's transaction commits. Here the whole test runs inside one
    transaction that never commits, so constraints are set immediate to force
    the same check at a point the test can observe.
    """
    user = UserFactory.create()

    with connection.cursor() as cursor:
        cursor.execute(LEGACY_TABLE_DDL)
        cursor.execute(
            "INSERT INTO social_auth_usersocialauth (provider, uid, user_id) "
            "VALUES ('ol-oidc', 'legacy-uid', %s)",
            [user.id],
        )
        # Settle the insert's own deferred check, so the only pending event
        # left is the one the delete below is meant to trigger.
        cursor.execute("SET CONSTRAINTS ALL IMMEDIATE")

    with pytest.raises(IntegrityError), transaction.atomic():
        User.objects.filter(pk=user.pk).delete()

    assert User.objects.filter(pk=user.pk).exists()

    run_migration_sql()

    User.objects.filter(pk=user.pk).delete()

    assert not User.objects.filter(pk=user.pk).exists()
