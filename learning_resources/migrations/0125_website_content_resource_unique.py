"""
Add a partial unique index for LearningResources mirrored from website content.

`unique_together` on ("platform", "readable_id", "resource_type") never binds
for these rows: editorial content has no platform, and Postgres treats NULLs in
a unique index as distinct, so two concurrent syncs of the same item both
insert. Every later sync for it then fails with MultipleObjectsReturned. This is
the same defect 0123 fixed for ContentFile, whose unique_together likewise
spanned nullable columns.

Built CONCURRENTLY for the same reason as 0123: an ordinary CREATE UNIQUE INDEX
holds ACCESS EXCLUSIVE for a full scan of a large table, blocking traffic behind
it. No dedupe step is needed -- the readable_id prefix is new, so no existing
row falls inside the index.
"""

from django.db import migrations, models
from django.db.models import Q

from learning_resources.constants import WEBSITE_CONTENT_READABLE_ID_PREFIX

TABLE = "learning_resources_learningresource"
INDEX_NAME = "learningresource_website_content_uniq"

# `_` is a single-character wildcard in LIKE, so the raw prefix would also
# match `websiteXcontent:1` and index rows this has no business constraining.
# Django escapes the same characters for `__startswith`, so escaping here is
# also what keeps the index identical to the model-state condition below.
LIKE_PREFIX = (
    WEBSITE_CONTENT_READABLE_ID_PREFIX.replace("\\", r"\\")
    .replace("_", r"\_")
    .replace("%", r"\%")
)


def build_index(apps, schema_editor):
    """Build the partial unique index without locking the table"""
    connection = schema_editor.connection
    with connection.cursor() as cursor:
        # A previously failed CONCURRENTLY build leaves an INVALID index
        # behind; clear it before (re)building.
        cursor.execute(f'DROP INDEX CONCURRENTLY IF EXISTS "{INDEX_NAME}"')
    with connection.cursor() as cursor:
        cursor.execute(
            f'CREATE UNIQUE INDEX CONCURRENTLY "{INDEX_NAME}"'
            f" ON {TABLE} (readable_id, resource_type)"
            # Single %: nothing is passed as a query parameter, so psycopg does
            # no interpolation here and a doubled one would reach Postgres
            # verbatim.
            f" WHERE readable_id LIKE '{LIKE_PREFIX}%'"
        )


def drop_index(apps, schema_editor):
    """Drop the partial unique index"""
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(f'DROP INDEX CONCURRENTLY IF EXISTS "{INDEX_NAME}"')


class Migration(migrations.Migration):
    """Partial unique index for website-content LearningResources"""

    # CREATE INDEX CONCURRENTLY cannot run inside a transaction
    atomic = False

    dependencies = [
        ("learning_resources", "0124_credential_metadata"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddConstraint(
                    model_name="learningresource",
                    constraint=models.UniqueConstraint(
                        condition=Q(
                            readable_id__startswith=WEBSITE_CONTENT_READABLE_ID_PREFIX
                        ),
                        fields=("readable_id", "resource_type"),
                        name=INDEX_NAME,
                    ),
                ),
            ],
            database_operations=[
                migrations.RunPython(build_index, drop_index, atomic=False),
            ],
        ),
    ]
