# Generated by Django 2.2.27 on 2022-07-22 18:42

import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("discussions", "0001_add_channels"),
    ]

    operations = [
        migrations.AlterField(
            model_name="channel",
            name="name",
            field=models.CharField(
                max_length=100,
                unique=True,
                validators=[
                    django.core.validators.RegexValidator(
                        message=(
                            "Channel name can only contain the characters: A-Z, a-z,"
                            " 0-9, _"
                        ),
                        regex="^[A-Za-z0-9_]+$",
                    )
                ],
            ),
        ),
    ]
