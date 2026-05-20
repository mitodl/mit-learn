"""

Ensure the website_content_editors Group exists in the database.

If the legacy article_editors Group exists, copy its members into the new group
so existing editors retain access after the rename.
"""

from django.db import migrations

OLD_GROUP_NAME = "article_editors"
NEW_GROUP_NAME = "website_content_editors"


def add_editors_group(apps, schema_editor):
    Group = apps.get_model("auth", "Group")

    new_group, _ = Group.objects.get_or_create(name=NEW_GROUP_NAME)
    old_group = Group.objects.filter(name=OLD_GROUP_NAME).first()

    if old_group and old_group.pk != new_group.pk:
        new_group.user_set.add(*old_group.user_set.all())


def remove_editors_group(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    Group.objects.filter(name=NEW_GROUP_NAME).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("website_content", "0002_migrate_from_articles"),
    ]

    operations = [
        migrations.RunPython(add_editors_group, remove_editors_group),
    ]
