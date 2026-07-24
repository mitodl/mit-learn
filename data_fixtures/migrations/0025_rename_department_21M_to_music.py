# Data migration: rename department 21M from "Music and Theater Arts" to "Music"

from django.db import migrations
from django.utils.text import slugify

OLD_NAME = "Music and Theater Arts"
NEW_NAME = "Music"


def _rename(apps, name):
    LearningResourceDepartment = apps.get_model(
        "learning_resources", "LearningResourceDepartment"
    )
    Channel = apps.get_model("channels", "Channel")

    department = LearningResourceDepartment.objects.filter(department_id="21M").first()
    if not department:
        return
    department.name = name
    department.save()

    channel = Channel.objects.filter(department_detail__department=department).first()
    if channel:
        channel.title = name
        channel.name = slugify(name)
        channel.save()


def rename_to_music(apps, schema_editor):
    _rename(apps, NEW_NAME)


def rename_to_music_and_theater_arts(apps, schema_editor):
    _rename(apps, OLD_NAME)


class Migration(migrations.Migration):
    dependencies = [
        (
            "data_fixtures",
            "0024_add_ovs_platform_offeror",
        ),
    ]

    operations = [
        migrations.RunPython(rename_to_music, rename_to_music_and_theater_arts),
    ]
