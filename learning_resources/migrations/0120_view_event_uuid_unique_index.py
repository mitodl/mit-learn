"""Build the unique index on event_uuid concurrently to avoid blocking reads"""

from django.db import migrations, models
from django.db.models import Q

INDEX_NAME = "learning_resources_lrviewevent_event_uuid_uniq"
TABLE_NAME = "learning_resources_learningresourceviewevent"


class Migration(migrations.Migration):
    # CREATE INDEX CONCURRENTLY cannot run inside a transaction
    atomic = False

    dependencies = [
        ("learning_resources", "0119_unique_resource_view_event"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddConstraint(
                    model_name="learningresourceviewevent",
                    constraint=models.UniqueConstraint(
                        condition=Q(event_uuid__isnull=False),
                        fields=("event_uuid",),
                        name=INDEX_NAME,
                    ),
                ),
            ],
            database_operations=[
                migrations.RunSQL(
                    [
                        # A failed CONCURRENTLY build leaves an INVALID index
                        # that IF NOT EXISTS would silently accept; drop any
                        # leftover so a rerun rebuilds and enforces uniqueness
                        f"DROP INDEX CONCURRENTLY IF EXISTS {INDEX_NAME}",
                        # Partial: the legacy NULL rows need no index entries
                        f"CREATE UNIQUE INDEX CONCURRENTLY {INDEX_NAME}"
                        f" ON {TABLE_NAME} (event_uuid)"
                        f" WHERE event_uuid IS NOT NULL",
                    ],
                    reverse_sql=f"DROP INDEX CONCURRENTLY IF EXISTS {INDEX_NAME}",
                ),
            ],
        ),
    ]
