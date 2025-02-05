# Generated by Django 4.2.14 on 2024-08-01 20:31

from urllib.parse import urlencode

from django.db import migrations
from django.utils.text import slugify

from channels.constants import ChannelType


def remove_sp(apps, schema_editor):
    """
    Remove department with department_id=SP
    """

    Channel = apps.get_model("channels", "Channel")
    LearningResourceDepartment = apps.get_model(
        "learning_resources", "LearningResourceDepartment"
    )
    department = LearningResourceDepartment.objects.filter(department_id="SP").first()
    if department:
        Channel.objects.filter(department_detail__department=department).delete()
        department.delete()


def add_sp(apps, schema_editor):
    LearningResourceDepartment = apps.get_model(
        "learning_resources", "LearningResourceDepartment"
    )
    Channel = apps.get_model("channels", "Channel")
    ChannelDepartmentDetail = apps.get_model("channels", "ChannelDepartmentDetail")

    department, _ = LearningResourceDepartment.objects.get_or_create(
        department_id="SP",
        name="Special Programs",
        defaults={
            "department_id": "SP",
            "name": "Special Programs",
        },
    )
    Channel = apps.get_model("channels", "Channel")

    channel = Channel.objects.create(
        search_filter=urlencode({"department": department.department_id}),
        channel_type=ChannelType.department.name,
        name=slugify(department.name),
        title=department.name,
    )
    ChannelDepartmentDetail.objects.get_or_create(
        channel=channel,
        department=department,
        defaults={"channel": channel, "department": department},
    )


class Migration(migrations.Migration):
    dependencies = [
        (
            "data_fixtures",
            "0013_remove_department_RES",
        ),
    ]

    operations = [
        migrations.RunPython(add_sp, remove_sp),
    ]
