"""
Collapse duplicate ContentFile rows and replace the ineffective 4-column
unique_together with three partial unique indexes, one per parent identity.

The old unique_together spanned three nullable FKs, so every row had a NULL in
the index and Postgres never rejected anything. Dedupe and constraint creation
live in the same migration so ingestion cannot introduce a new duplicate in
between, and each concurrent index build re-dedupes and retries on failure:
ingestion keeps running while this migration runs (old-release pods, plus
celery workers that roll concurrently with the pre-deploy migrate job), so a
fresh duplicate can land mid-build and fail CREATE UNIQUE INDEX CONCURRENTLY.
"""

import time

from django.db import DatabaseError, OperationalError, migrations, models
from django.db.models import Q

TABLE = "learning_resources_contentfile"
TAGS_TABLE = "learning_resources_contentfile_content_tags"

# Django's deterministic name for the old unique_together constraint
# (verified identical in local and production databases).
OLD_UNIQUE_CONSTRAINT = (
    "learning_resources_conte_key_run_id_learning_reso_cf8309bd_uniq"
)

# (parent column, index name)
IDENTITIES = [
    ("run_id", "contentfile_run_key_uniq"),
    ("learning_resource_id", "contentfile_learning_resource_key_uniq"),
    (
        "direct_learning_resource_id",
        "contentfile_direct_learning_resource_key_uniq",
    ),
]

BUILD_ATTEMPTS = 3

# NULL keys partition together, which is what we want here: two keyless rows on
# the same parent from the same ingest race are duplicates of each other (the
# NULLS NOT DISTINCT indexes enforce the same rule going forward). Keep
# priority: a row with a summary (expensive LLM output) first, then the most
# recently updated, then the highest id.
#
# One statement, so both deletes see the same loser set even while the previous
# release is still inserting rows. The through table's FK has no database-level
# ON DELETE CASCADE (Django emulates it in the ORM), but its RI trigger fires
# at end of statement, after the CTE has removed the tag rows.
DEDUPE_SQL = """
WITH losers AS (
    SELECT id FROM (
        SELECT
            id,
            ROW_NUMBER() OVER (
                PARTITION BY {column}, key
                ORDER BY (COALESCE(summary, '') <> '') DESC, updated_on DESC, id DESC
            ) AS rn
        FROM {table}
        WHERE {column} IS NOT NULL
    ) ranked
    WHERE ranked.rn > 1
),
deleted_tags AS (
    DELETE FROM {tags_table} WHERE contentfile_id IN (SELECT id FROM losers)
)
DELETE FROM {table} WHERE id IN (SELECT id FROM losers)
"""


def _dedupe_identity(connection, column):
    """Delete all but the best row in each (parent, key) group for one parent"""
    with connection.cursor() as cursor:
        cursor.execute(
            DEDUPE_SQL.format(column=column, table=TABLE, tags_table=TAGS_TABLE)
        )


def dedupe_content_files(apps, schema_editor):
    """Delete duplicate rows for all three parent identities"""
    for column, _ in IDENTITIES:
        _dedupe_identity(schema_editor.connection, column)


def drop_old_unique_together(apps, schema_editor):
    """
    Drop the old unique_together constraint without risking a lock queue.

    DROP CONSTRAINT needs ACCESS EXCLUSIVE; if a long-running query holds the
    table, the lock request queues and blocks all traffic behind it. A short
    lock_timeout aborts the attempt instead, and we retry.
    """
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("SET lock_timeout = '5s'")
        try:
            for attempt in range(1, BUILD_ATTEMPTS + 1):
                try:
                    cursor.execute(
                        f"ALTER TABLE {TABLE}"
                        f' DROP CONSTRAINT IF EXISTS "{OLD_UNIQUE_CONSTRAINT}"'
                    )
                except OperationalError:
                    if attempt == BUILD_ATTEMPTS:
                        raise
                    time.sleep(5)
                else:
                    break
        finally:
            cursor.execute("RESET lock_timeout")


def _build_index(column, name):
    """Forward function: build one partial unique index, retrying on races"""

    def forward(apps, schema_editor):
        connection = schema_editor.connection
        for attempt in range(1, BUILD_ATTEMPTS + 1):
            with connection.cursor() as cursor:
                # A previously failed CONCURRENTLY build leaves an INVALID
                # index behind; clear it before (re)building. CONCURRENTLY so
                # the drop cannot queue an ACCESS EXCLUSIVE lock behind a
                # long-running query and stall traffic.
                cursor.execute(f'DROP INDEX CONCURRENTLY IF EXISTS "{name}"')
            try:
                with connection.cursor() as cursor:
                    # NULLS NOT DISTINCT so keyless rows on the same parent
                    # collide too (key is nullable; PG >= 15).
                    cursor.execute(
                        f'CREATE UNIQUE INDEX CONCURRENTLY "{name}"'
                        f" ON {TABLE} ({column}, key)"
                        f" NULLS NOT DISTINCT"
                        f" WHERE {column} IS NOT NULL"
                    )
            except DatabaseError:
                if attempt == BUILD_ATTEMPTS:
                    raise
                _dedupe_identity(connection, column)
            else:
                return

    return forward


def _drop_index(name):
    """Reverse function: drop one partial unique index"""

    def reverse(apps, schema_editor):
        with schema_editor.connection.cursor() as cursor:
            cursor.execute(f'DROP INDEX CONCURRENTLY IF EXISTS "{name}"')

    return reverse


class Migration(migrations.Migration):
    """Dedupe ContentFile rows, then replace unique_together with partial indexes"""

    # CREATE INDEX CONCURRENTLY cannot run inside a transaction
    atomic = False

    dependencies = [
        ("learning_resources", "0122_topic_default_ordering"),
    ]

    operations = [
        # reverse is a no-op: deleted duplicates cannot be restored
        migrations.RunPython(dedupe_content_files, migrations.RunPython.noop),
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AlterUniqueTogether(
                    name="contentfile",
                    unique_together=set(),
                ),
            ],
            database_operations=[
                # reverse is a no-op: the old constraint never rejected
                # anything, so nothing is lost by not recreating it
                migrations.RunPython(
                    drop_old_unique_together,
                    migrations.RunPython.noop,
                    atomic=False,
                ),
            ],
        ),
        *[
            migrations.SeparateDatabaseAndState(
                state_operations=[
                    migrations.AddConstraint(
                        model_name="contentfile",
                        constraint=models.UniqueConstraint(
                            condition=Q(
                                **{f"{column.removesuffix('_id')}__isnull": False}
                            ),
                            fields=(column.removesuffix("_id"), "key"),
                            nulls_distinct=False,
                            name=name,
                        ),
                    ),
                ],
                database_operations=[
                    migrations.RunPython(
                        _build_index(column, name),
                        _drop_index(name),
                        atomic=False,
                    ),
                ],
            )
            for column, name in IDENTITIES
        ],
    ]
