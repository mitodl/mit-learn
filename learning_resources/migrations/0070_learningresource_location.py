# Generated by Django 4.2.16 on 2024-09-24 15:28

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources", "0069_learningresource_ocw_topics"),
    ]

    operations = [
        migrations.AddField(
            model_name="learningresource",
            name="location",
            field=models.CharField(blank=True, max_length=256),
        ),
        migrations.AddField(
            model_name="learningresourcerun",
            name="location",
            field=models.CharField(blank=True, max_length=256),
        ),
    ]
