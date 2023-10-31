# Generated by Django 4.1.10 on 2023-10-27 19:28

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources", "0021_offeror_code_professional"),
    ]

    operations = [
        migrations.AlterField(
            model_name="learningresource",
            name="resource_type",
            field=models.CharField(
                choices=[
                    ("course", "Course"),
                    ("program", "Program"),
                    ("learning_path", "Learning Path"),
                    ("podcast", "Podcast"),
                    ("podcast_episode", "Podcast Episode"),
                ],
                db_index=True,
                max_length=24,
            ),
        ),
    ]
