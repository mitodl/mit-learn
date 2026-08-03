"""Dedupe LearningResourceViewEvent rows, then enforce uniqueness"""

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
        migrations.RunPython(dedupe_view_events, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="learningresourceviewevent",
            constraint=models.UniqueConstraint(
                fields=("learning_resource", "event_date"),
                name="unique_resource_view_event",
            ),
        ),
    ]
