# Generated by Django 4.2.16 on 2024-09-16 18:18

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources", "0065_learningresourcerun_availability"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="learningresource",
            name="learning_format",
        ),
    ]