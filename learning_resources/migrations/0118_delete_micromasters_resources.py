from django.db import migrations


def delete_micromasters_resources(apps, schema_editor):
    """Delete all micromasters resources (already deindexed by 0117)"""
    LearningResource = apps.get_model("learning_resources", "LearningResource")
    LearningResource.objects.filter(etl_source="micromasters").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources", "0117_unpublish_micromasters_resources"),
    ]

    operations = [
        migrations.RunPython(delete_micromasters_resources, migrations.RunPython.noop),
    ]
