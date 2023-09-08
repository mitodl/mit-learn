# Generated by Django 2.1.7 on 2019-04-30 21:29

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("course_catalog", "0020_course_availability")]

    operations = [
        migrations.AddField(
            model_name="course",
            name="program_name",
            field=models.CharField(blank=True, max_length=256, null=True),
        ),
        migrations.AddField(
            model_name="course",
            name="program_type",
            field=models.CharField(blank=True, max_length=32, null=True),
        ),
    ]
