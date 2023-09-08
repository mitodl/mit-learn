# Generated by Django 2.1.11 on 2019-10-09 18:03

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("course_catalog", "0042_rename_run_id")]

    operations = [
        migrations.RemoveField(model_name="program", name="prices"),
        migrations.AlterField(
            model_name="learningresourcerun",
            name="content_type",
            field=models.ForeignKey(
                limit_choices_to={"model__in": ("course", "bootcamp", "program")},
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                to="contenttypes.ContentType",
            ),
        ),
    ]
