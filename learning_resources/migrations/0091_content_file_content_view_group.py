from django.contrib.auth.models import Group
from django.db import migrations

from learning_resources import constants


def add_content_file_content_viewers(apps, schema_editor):
    """
    Create group that can view content file content from the APIs
    """
    Group.objects.get_or_create(name=constants.GROUP_CONTENT_FILE_CONTENT_VIEWERS)


def remove_content_file_content_viewers(apps, schema_editor):
    """
    Delete the staff list editors group
    """
    Group.objects.filter(name=constants.GROUP_CONTENT_FILE_CONTENT_VIEWERS).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources", "0090_learningresource_test_mode"),
    ]

    operations = [
        migrations.RunPython(
            add_content_file_content_viewers, remove_content_file_content_viewers
        ),
    ]
