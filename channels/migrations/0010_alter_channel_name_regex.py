# Generated by Django 4.2.13 on 2024-06-27 14:50

import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("channels", "0009_rename_field_to_channel"),
    ]

    operations = [
        migrations.AlterField(
            model_name="channel",
            name="name",
            field=models.CharField(
                max_length=100,
                validators=[
                    django.core.validators.RegexValidator(
                        message=(
                            "Channel name can only contain the characters: A-Z,"
                            " a-z, 0-9, _"
                        ),
                        regex="^[A-Za-z0-9_-]+$",
                    )
                ],
            ),
        ),
    ]