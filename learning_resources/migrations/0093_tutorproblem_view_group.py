from django.contrib.auth.models import Group
from django.db import migrations

from learning_resources import constants


def add_tutor_problem_viewers(apps, schema_editor):
    """
    Create group that can view tutor problems from the APIs
    """
    Group.objects.get_or_create(name=constants.GROUP_TUTOR_PROBLEM_VIEWERS)


def remove_tutor_problem_viewers(apps, schema_editor):
    """
    Delete the tutor problem viewers group
    """
    Group.objects.filter(name=constants.GROUP_TUTOR_PROBLEM_VIEWERS).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources", "0092_tutorproblemfile"),
    ]

    operations = [
        migrations.RunPython(add_tutor_problem_viewers, remove_tutor_problem_viewers),
    ]
