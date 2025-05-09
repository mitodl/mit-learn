# Generated by Django 4.2.20 on 2025-04-25 19:34

from django.db import migrations, models


def populate_archive_checksum(apps, schema_editor):
    for content_file in apps.get_model(
        "learning_resources", "ContentFile"
    ).objects.all():
        if content_file.archive_checksum is None:
            content_file.archive_checksum = content_file.checksum
            content_file.save()


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources", "0088_add_content_summarizer_config"),
    ]

    operations = [
        migrations.AddField(
            model_name="contentfile",
            name="archive_checksum",
            field=models.CharField(blank=True, max_length=32, null=True),
        ),
        migrations.RunPython(populate_archive_checksum, migrations.RunPython.noop),
    ]
