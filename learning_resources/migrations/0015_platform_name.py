# Generated by Django 4.1.10 on 2023-09-28 16:54

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources", "0014_modify_offered_by"),
    ]

    operations = [
        migrations.AddField(
            model_name="learningresourceplatform",
            name="name",
            field=models.CharField(default="", max_length=256),
        ),
    ]
