from django.db import migrations


def backfill_view_counts(apps, schema_editor):
    """Populate LearningResource.view_count for resources with existing view events

    Runs once at deploy time so sortby=-views orders correctly immediately,
    rather than leaving NULL view_count on already-viewed resources until the
    next scheduled calculate_resource_view_counts run.
    """
    # Runtime import so this stays in sync with the real (non-historical)
    # batching/chunking logic instead of duplicating it here
    from learning_resources.api import update_resource_view_counts

    update_resource_view_counts()


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources", "0118_delete_micromasters_resources"),
    ]

    operations = [
        migrations.RunPython(backfill_view_counts, migrations.RunPython.noop),
    ]
