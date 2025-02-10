# Generated by Django 4.2.18 on 2025-02-05 22:13

from django.db import migrations


def change_user_type(apps, schema_editor):
    """Update the ContentType for User to point to the custom one"""
    ContentType = apps.get_model("contenttypes", "ContentType")
    ct = ContentType.objects.filter(app_label="auth", model="user").first()
    if ct:
        ct.app_label = "users"
        ct.save()


def revert_user_type(apps, schema_editor):
    """Update the ContentType for User to point to the default django one"""
    ContentType = apps.get_model("contenttypes", "ContentType")
    ct = ContentType.objects.filter(app_label="users", model="user").first()
    if ct:
        ct.app_label = "auth"
        ct.save()


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0001_initial"),
    ]

    operations = [migrations.RunPython(change_user_type, revert_user_type)]
