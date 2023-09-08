# Generated by Django 2.2.27 on 2022-07-15 19:12

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("course_catalog", "0090_contentfile_published"),
        ("channels_fields", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="fieldchannel",
            name="description",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="fieldchannel",
            name="featured_list",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to="course_catalog.UserList",
            ),
        ),
        migrations.CreateModel(
            name="FieldList",
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
                ("created_on", models.DateTimeField(auto_now_add=True)),
                ("updated_on", models.DateTimeField(auto_now=True)),
                ("position", models.IntegerField(default=0)),
                (
                    "field_channel",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="lists",
                        to="channels_fields.FieldChannel",
                    ),
                ),
                (
                    "field_list",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        to="course_catalog.UserList",
                    ),
                ),
            ],
            options={"unique_together": {("field_list", "field_channel")}},
        ),
    ]
