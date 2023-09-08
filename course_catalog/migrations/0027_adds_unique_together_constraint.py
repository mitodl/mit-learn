# Generated by Django 2.1.7 on 2019-06-19 17:52

from django.conf import settings
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("contenttypes", "0002_remove_content_type_name"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("course_catalog", "0026_adds_list_type_to_userlist"),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name="favoriteitem", unique_together={("user", "content_type", "object_id")}
        )
    ]
