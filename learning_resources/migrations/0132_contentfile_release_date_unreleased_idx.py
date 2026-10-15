"""Partial release-date index for the hourly sweep and visible content-file counts"""

from django.db import migrations, models

INDEX_NAME = "contentfile_published_date_idx"
TABLE_NAME = "learning_resources_contentfile"


class Migration(migrations.Migration):
    # CREATE INDEX CONCURRENTLY cannot run inside a transaction
    atomic = False

    dependencies = [
        ("learning_resources", "0131_contentfile_release_date"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddIndex(
                    model_name="contentfile",
                    index=models.Index(
                        fields=["release_date"],
                        condition=models.Q(published=True),
                        name=INDEX_NAME,
                    ),
                ),
            ],
            database_operations=[
                migrations.RunSQL(
                    [
                        # A failed CONCURRENTLY build leaves an INVALID index
                        # under this name, which would make CREATE fail.
                        f"DROP INDEX CONCURRENTLY IF EXISTS {INDEX_NAME}",
                        (
                            f"CREATE INDEX CONCURRENTLY {INDEX_NAME}"
                            f" ON {TABLE_NAME} (release_date) WHERE published"
                        ),
                    ],
                    reverse_sql=f"DROP INDEX CONCURRENTLY IF EXISTS {INDEX_NAME}",
                ),
            ],
        ),
    ]
