# Generated by Django 2.2.10 on 2020-03-30 13:00

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("course_catalog", "0062_content_type_choices")]

    operations = [
        migrations.AlterModelOptions(
            name="courseinstructor", options={"ordering": ["last_name"]}
        )
    ]
