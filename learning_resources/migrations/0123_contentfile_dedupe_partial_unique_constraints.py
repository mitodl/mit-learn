"""
Collapse duplicate ContentFile rows and replace the ineffective 4-column
unique_together with three partial unique indexes, one per parent identity.

The old unique_together spanned three nullable FKs, so every row had a NULL in
the index and Postgres never rejected anything. Dedupe and constraint creation
live in the same migration so ingestion cannot introduce a new duplicate in
between, and each concurrent index build re-dedupes and retries on failure:
while this migration runs, the previous release is still ingesting without any
duplicate protection, so a fresh duplicate can land mid-build and fail
CREATE UNIQUE INDEX CONCURRENTLY.
"""

from django.db import DatabaseError, migrations, models
from django.db.models import Q

TABLE = "learning_resources_contentfile"
TAGS_TABLE = "learning_resources_contentfile_content_tags"

# (parent column, index name)
IDENTITIES = [
    ("run_id", "contentfile_run_key_uniq"),
    ("learning_resource_id", "contentfile_learning_resource_key_uniq"),
    (
        "direct_learning_resource_id",
        "contentfile_direct_learning_resource_key_uniq",
    ),
]

DELETE_BATCH_SIZE = 5000
BUILD_ATTEMPTS = 3

# NULL keys partition together, which is what we want here: two keyless rows on
# the same parent from the same ingest race are duplicates of each other. Keep
# priority: a row with a summary (expensive LLM output) first, then the most
# recently updated, then the highest id.
LOSER_IDS_SQL = """
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
"""


def _dedupe_identity(connection, column):
    """Delete all but the best row in each (parent, key) group for one parent"""
    with connection.cursor() as cursor:
        cursor.execute(LOSER_IDS_SQL.format(column=column, table=TABLE))
        loser_ids = [row[0] for row in cursor.fetchall()]

    for start in range(0, len(loser_ids), DELETE_BATCH_SIZE):
        batch = loser_ids[start : start + DELETE_BATCH_SIZE]
        with connection.cursor() as cursor:
            # The through table's FK has no database-level ON DELETE CASCADE
            # (Django emulates it in the ORM), so its rows must go first or
            # the row delete hits a FK violation.
            cursor.execute(
                f"DELETE FROM {TAGS_TABLE} WHERE contentfile_id = ANY(%s)",  # noqa: S608
                [batch],
            )
            cursor.execute(
                f"DELETE FROM {TABLE} WHERE id = ANY(%s)",  # noqa: S608
                [batch],
            )


def dedupe_content_files(apps, schema_editor):
    """Delete duplicate rows for all three parent identities"""
    for column, _ in IDENTITIES:
        _dedupe_identity(schema_editor.connection, column)


def noop(apps, schema_editor):
    """Do nothing on reverse - deleted duplicates cannot be restored."""


def _build_index(column, name):
    """Forward function: build one partial unique index, retrying on races"""

    def forward(apps, schema_editor):
        connection = schema_editor.connection
        for attempt in range(1, BUILD_ATTEMPTS + 1):
            with connection.cursor() as cursor:
                # A previously failed CONCURRENTLY build leaves an INVALID
                # index behind; clear it before (re)building.
                cursor.execute(f'DROP INDEX IF EXISTS "{name}"')
            try:
                with connection.cursor() as cursor:
                    cursor.execute(
                        f'CREATE UNIQUE INDEX CONCURRENTLY "{name}"'
                        f" ON {TABLE} ({column}, key)"
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
            cursor.execute(f'DROP INDEX IF EXISTS "{name}"')

    return reverse


class Migration(migrations.Migration):
    """Dedupe ContentFile rows, then replace unique_together with partial indexes"""

    # CREATE INDEX CONCURRENTLY cannot run inside a transaction
    atomic = False

    dependencies = [
        ("learning_resources", "0122_topic_default_ordering"),
    ]

    operations = [
        migrations.RunPython(dedupe_content_files, noop),
        migrations.AlterUniqueTogether(
            name="contentfile",
            unique_together=set(),
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
