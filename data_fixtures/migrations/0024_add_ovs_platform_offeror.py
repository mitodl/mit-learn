# Generated manually

from django.db import migrations


def remove_ovs_platform(apps, schema_editor):
    """Remove OVS platform"""
    LearningResourcePlatform = apps.get_model(
        "learning_resources", "LearningResourcePlatform"
    )
    LearningResourcePlatform.objects.filter(code="ovs").delete()


def add_ovs_platform(apps, schema_editor):
    """Add OVS platform"""
    LearningResourcePlatform = apps.get_model(
        "learning_resources", "LearningResourcePlatform"
    )
    LearningResourcePlatform.objects.update_or_create(
        code="ovs",
        defaults={
            "name": "ODL Video Service",
            "is_edx": False,
            "has_content_files": False,
            "url": "https://video.odl.mit.edu/",
        },
    )


class Migration(migrations.Migration):
    dependencies = [
        ("data_fixtures", "0023_add_natural_climate_topic"),
    ]

    operations = [
        migrations.RunPython(add_ovs_platform, remove_ovs_platform),
    ]
