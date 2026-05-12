"""
Ensure the article_editors Group exists in the database.

Reuses the same group name as the old articles app so that existing users
already in the group retain their permissions without any manual intervention.
"""

from django.contrib.auth.models import Group
from django.db import migrations

from website_content.constants import GROUP_STAFF_ARTICLE_EDITORS


def add_editors_group(apps, schema_editor):  # noqa: ARG001
    Group.objects.get_or_create(name=GROUP_STAFF_ARTICLE_EDITORS)


def remove_editors_group(apps, schema_editor):  # noqa: ARG001
    Group.objects.filter(name=GROUP_STAFF_ARTICLE_EDITORS).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("website_content", "0002_migrate_from_articles"),
    ]

    operations = [
        migrations.RunPython(add_editors_group, remove_editors_group),
    ]
