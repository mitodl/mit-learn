# Generated by Django 4.2.19 on 2025-02-13 13:20

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources", "0086_contentfile_run_or_resource_defined"),
    ]

    operations = [
        migrations.AddField(
            model_name="contentfile",
            name="flashcards",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="contentfile",
            name="summary",
            field=models.TextField(blank=True, default=""),
        ),
    ]
