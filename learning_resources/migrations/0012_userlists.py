# Generated by Django 4.1.10 on 2023-09-07 18:08

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("learning_resources", "0011_learningresourcerun_checksum"),
    ]

    operations = [
        migrations.CreateModel(
            name="UserList",
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
                ("description", models.TextField(blank=True, null=True)),
                (
                    "author",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="user_lists",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "abstract": False,
            },
        ),
        migrations.CreateModel(
            name="UserListRelationship",
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
                ("position", models.PositiveIntegerField(default=0)),
                (
                    "child",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="user_lists",
                        to="learning_resources.learningresource",
                    ),
                ),
                (
                    "parent",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="children",
                        to="learning_resources.userlist",
                    ),
                ),
            ],
            options={
                "abstract": False,
            },
        ),
        migrations.AddField(
            model_name="userlist",
            name="resources",
            field=models.ManyToManyField(
                blank=True,
                through="learning_resources.UserListRelationship",
                to="learning_resources.learningresource",
            ),
        ),
        migrations.AddField(
            model_name="userlist",
            name="topics",
            field=models.ManyToManyField(to="learning_resources.learningresourcetopic"),
        ),
    ]
