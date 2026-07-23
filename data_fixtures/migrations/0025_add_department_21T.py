# Data migration: add department 21T (Theater Arts)

from urllib.parse import urlencode

from django.db import migrations
from django.utils.text import slugify

from channels.constants import ChannelType

SCHOOL_NAME = "School of Humanities, Arts, and Social Sciences"


def remove_theater_arts(apps, schema_editor):
    """
    Remove department with department_id=21T
    """

    Channel = apps.get_model("channels", "Channel")
    LearningResourceDepartment = apps.get_model(
        "learning_resources", "LearningResourceDepartment"
    )
    department = LearningResourceDepartment.objects.filter(department_id="21T").first()
    if department:
        Channel.objects.filter(department_detail__department=department).delete()
        department.delete()


def add_theater_arts(apps, schema_editor):
    LearningResourceDepartment = apps.get_model(
        "learning_resources", "LearningResourceDepartment"
    )
    LearningResourceSchool = apps.get_model(
        "learning_resources", "LearningResourceSchool"
    )
    Channel = apps.get_model("channels", "Channel")
    ChannelDepartmentDetail = apps.get_model("channels", "ChannelDepartmentDetail")

    school = LearningResourceSchool.objects.filter(name=SCHOOL_NAME).first()

    department, _ = LearningResourceDepartment.objects.get_or_create(
        department_id="21T",
        defaults={
            "name": "Theater Arts",
            "school": school,
        },
    )

    channel, _ = Channel.objects.get_or_create(
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
            "0024_add_ovs_platform_offeror",
        ),
    ]

    operations = [
        migrations.RunPython(add_theater_arts, remove_theater_arts),
    ]
