"""Dedupe LearningResourceViewEvent rows and add a unique PostHog event UUID"""

from django.db import migrations, models
from django.db.models import Count, Min


def dedupe_view_events(apps, schema_editor):
    """Delete duplicate view events, keeping the oldest row per pair"""
    LearningResourceViewEvent = apps.get_model(
        "learning_resources", "LearningResourceViewEvent"
    )
    dupes = (
        LearningResourceViewEvent.objects.values("learning_resource", "event_date")
        .annotate(num_events=Count("id"), keep_id=Min("id"))
        .filter(num_events__gt=1)
    )
    for dupe in dupes:
        LearningResourceViewEvent.objects.filter(
            learning_resource=dupe["learning_resource"],
            event_date=dupe["event_date"],
        ).exclude(id=dupe["keep_id"]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources", "0118_delete_micromasters_resources"),
    ]

    operations = [
        # Block concurrent writes (e.g. the PostHog ETL task) for the duration
        # of the transaction so no new duplicates appear during the dedupe
        migrations.RunSQL(
            "LOCK TABLE learning_resources_learningresourceviewevent IN EXCLUSIVE MODE",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunPython(dedupe_view_events, migrations.RunPython.noop),
        migrations.AddField(
            model_name="learningresourceviewevent",
            name="event_uuid",
            field=models.UUIDField(
                editable=False,
                help_text=(
                    "The PostHog event UUID. Null only for rows loaded"
                    " before this field existed."
                ),
                null=True,
                unique=True,
            ),
        ),
    ]
