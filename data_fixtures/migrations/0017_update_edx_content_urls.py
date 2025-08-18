# Generated manually


from django.db import migrations
from django.db.models import Value
from django.db.models.functions import Replace

from learning_resources.utils import content_files_loaded_actions


def update_contentfile_urls(apps, schema_editor):
    """
    Update incorrect ContentFile URLs that use the "/jump_to/" format
    """

    ContentFile = apps.get_model("learning_resources", "ContentFile")
    LearningResourceRun = apps.get_model("learning_resources", "LearningResourceRun")
    content_files = ContentFile.objects.filter(url__contains="/jump_to/").only(
        "id", "url", "run__id"
    )
    # Get unique run IDs before updating
    run_ids = set(content_files.values_list("run__id", flat=True).distinct())

    # Update all ContentFile URLs in a single database query
    content_files.update(url=Replace("url", Value("/jump_to/"), Value("/jump_to_id/")))

    # Process the runs
    for run in LearningResourceRun.objects.filter(id__in=run_ids):
        content_files_loaded_actions(run)


class Migration(migrations.Migration):
    dependencies = [
        (
            "data_fixtures",
            "0016_add_canvas_platform",
        ),
    ]

    operations = [
        migrations.RunPython(
            update_contentfile_urls, reverse_code=migrations.RunPython.noop
        ),
    ]
