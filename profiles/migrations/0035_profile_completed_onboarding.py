# Generated by Django 4.2.20 on 2025-04-15 14:14

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("profiles", "0034_remove_profile_scim_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="completed_onboarding",
            field=models.BooleanField(default=False),
        ),
    ]
