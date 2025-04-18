# Generated by Django 4.2.15 on 2024-08-14 19:40

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("profiles", "0031_alter_profile_goals"),
    ]

    operations = [
        migrations.AlterField(
            model_name="profile",
            name="current_education",
            field=models.CharField(
                blank=True,
                choices=[
                    ("", "----"),
                    ("Doctorate", "Doctorate"),
                    (
                        "Master's or professional degree",
                        "Master's or professional degree",
                    ),
                    ("Bachelor's degree", "Bachelor's degree"),
                    ("Associate degree", "Associate degree"),
                    ("Secondary/high school", "Secondary/high school"),
                    (
                        "Junior secondary/junior high/middle school",
                        "Junior secondary/junior high/middle school",
                    ),
                    ("No formal education", "No formal education"),
                    ("Other education", "Other education"),
                ],
                default="",
                max_length=50,
            ),
        ),
    ]
