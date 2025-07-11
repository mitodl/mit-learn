# Generated manually


from django.db import migrations


def remove_canvas_platform(apps, schema_editor):
    """
    Remove canvas platform
    """

    LearningResourcePlatform = apps.get_model(
        "learning_resources", "LearningResourcePlatform"
    )
    LearningResourcePlatform.objects.filter(code="canvas").delete()


def add_canvas_platform(apps, schema_editor):
    LearningResourcePlatform = apps.get_model(
        "learning_resources", "LearningResourcePlatform"
    )

    LearningResourcePlatform.objects.update_or_create(
        code="canvas",
        defaults={
            "name": "Canvas",
            "is_edx": False,
            "has_content_files": True,
            "url": "https://web.mit.edu/canvas/",
        },
    )


class Migration(migrations.Migration):
    dependencies = [
        (
            "data_fixtures",
            "0015_unit_page_copy_updates",
        ),
    ]

    operations = [
        migrations.RunPython(add_canvas_platform, remove_canvas_platform),
    ]
