# Generated manually


from django.db import migrations


def remove_climate_platform(apps, schema_editor):
    """
    Remove canvas platform
    """

    LearningResourcePlatform = apps.get_model(
        "learning_resources", "LearningResourcePlatform"
    )
    LearningResourcePlatform.objects.filter(code="climate").delete()


def add_climate_platform(apps, schema_editor):
    LearningResourcePlatform = apps.get_model(
        "learning_resources", "LearningResourcePlatform"
    )

    LearningResourcePlatform.objects.update_or_create(
        code="climate",
        defaults={
            "name": "MIT Climate",
            "is_edx": False,
            "has_content_files": False,
            "url": "https://climate.mit.edu/",
        },
    )


class Migration(migrations.Migration):
    dependencies = [
        (
            "data_fixtures",
            "0017_update_edx_content_urls",
        ),
    ]

    operations = [
        migrations.RunPython(add_climate_platform, remove_climate_platform),
    ]
