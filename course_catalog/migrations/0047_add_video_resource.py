# Generated by Django 2.1.11 on 2019-10-21 19:24

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("course_catalog", "0046_add_learning_resource_offeror")]

    operations = [
        migrations.CreateModel(
            name="VideoResource",
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
                ("title", models.CharField(max_length=256)),
                ("short_description", models.TextField(blank=True, null=True)),
                (
                    "_deprecated_offered_by",
                    models.CharField(
                        blank=True, db_column="offered_by", max_length=128, null=True
                    ),
                ),
                ("video_id", models.CharField(max_length=80)),
                ("platform", models.CharField(max_length=128)),
                ("full_description", models.TextField(blank=True, null=True)),
                ("image_src", models.URLField(blank=True, max_length=400, null=True)),
                ("last_modified", models.DateTimeField(blank=True, null=True)),
                ("published", models.BooleanField(default=True)),
                ("url", models.URLField(max_length=2048, null=True)),
                ("transcript", models.TextField(blank=True, default="")),
                ("raw_data", models.TextField(blank=True, default="")),
                (
                    "offered_by",
                    models.ManyToManyField(
                        blank=True, to="course_catalog.LearningResourceOfferor"
                    ),
                ),
                (
                    "topics",
                    models.ManyToManyField(blank=True, to="course_catalog.CourseTopic"),
                ),
            ],
        ),
        migrations.AlterUniqueTogether(
            name="videoresource", unique_together={("platform", "video_id")}
        ),
    ]
