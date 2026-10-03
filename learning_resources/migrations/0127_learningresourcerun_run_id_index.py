"""
Index run_id on its own so delete_moved_runs (called per run during ETL)
can find same-source rows without falling back to a scan of the composite
(learning_resource_id, run_id) index.
"""

from django.db import migrations, models

INDEX_NAME = "learning_resources_lrrun_run_id_idx"
TABLE_NAME = "learning_resources_learningresourcerun"


class Migration(migrations.Migration):
    # CREATE INDEX CONCURRENTLY cannot run inside a transaction
    atomic = False

    dependencies = [
        ("learning_resources", "0126_credential_metadata_store"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AlterField(
                    model_name="learningresourcerun",
                    name="run_id",
                    field=models.CharField(db_index=True, max_length=128),
                ),
            ],
            database_operations=[
                migrations.RunSQL(
                    [
                        # An INVALID leftover from a failed CONCURRENTLY build
                        # would satisfy IF NOT EXISTS silently — drop first.
                        f"DROP INDEX CONCURRENTLY IF EXISTS {INDEX_NAME}",
                        (
                            f"CREATE INDEX CONCURRENTLY {INDEX_NAME}"
                            f" ON {TABLE_NAME} (run_id)"
                        ),
                    ],
                    reverse_sql=f"DROP INDEX CONCURRENTLY IF EXISTS {INDEX_NAME}",
                ),
            ],
        ),
    ]
