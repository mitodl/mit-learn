# Generated by Django 4.2.16 on 2024-10-31 19:47

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources", "0073_learningresourceinstructor_through"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="learningresourcerun",
            name="instructors",
        ),
    ]
