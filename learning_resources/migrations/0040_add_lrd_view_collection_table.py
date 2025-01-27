# Generated by Django 4.2.11 on 2024-04-19 16:14

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources", "0039_videos"),
    ]

    operations = [
        migrations.CreateModel(
            name="LearningResourceViewEvent",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("created_on", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_on", models.DateTimeField(auto_now=True)),
                (
                    "event_date",
                    models.DateTimeField(
                        editable=False,
                        help_text=(
                            "The date of the lrd_view event, as collected by PostHog."
                        ),
                    ),
                ),
                (
                    "learning_resource",
                    models.ForeignKey(
                        editable=False,
                        help_text="The learning resource for this event.",
                        on_delete=django.db.models.deletion.DO_NOTHING,
                        related_name="views",
                        to="learning_resources.learningresource",
                    ),
                ),
            ],
            options={
                "abstract": False,
            },
        ),
    ]
