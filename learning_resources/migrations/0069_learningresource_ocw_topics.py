# Generated by Django 4.2.16 on 2024-09-23 18:04

import django.contrib.postgres.fields
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources", "0068_learningresource_format_pace"),
    ]

    operations = [
        migrations.AddField(
            model_name="learningresource",
            name="ocw_topics",
            field=django.contrib.postgres.fields.ArrayField(
                base_field=models.CharField(max_length=128),
                blank=True,
                default=list,
                size=None,
            ),
        ),
    ]