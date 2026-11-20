"""Index for the units API's run order"""

from django.db import migrations, models

INDEX_NAME = "unit_run_position_idx"
TABLE_NAME = "learning_resources_unit"


class Migration(migrations.Migration):
    # CREATE INDEX CONCURRENTLY cannot run inside a transaction
    atomic = False

    dependencies = [
        ("learning_resources", "0140_claim_extraction_unit_parts"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddIndex(
                    model_name="unit",
                    index=models.Index(
                        fields=["run", "position", "id"], name=INDEX_NAME
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
                            f" ON {TABLE_NAME} (run_id, position, id)"
                        ),
                    ],
                    reverse_sql=f"DROP INDEX CONCURRENTLY IF EXISTS {INDEX_NAME}",
                ),
            ],
        ),
    ]
