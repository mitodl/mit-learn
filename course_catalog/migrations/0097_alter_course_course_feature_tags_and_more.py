# Generated by Django 4.1.9 on 2023-06-08 13:00

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("course_catalog", "0096_checksums"),
    ]

    operations = [
        migrations.AlterField(
            model_name="course",
            name="course_feature_tags",
            field=models.JSONField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="course",
            name="raw_json",
            field=models.JSONField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="learningresourcerun",
            name="raw_json",
            field=models.JSONField(blank=True, null=True),
        ),
    ]
