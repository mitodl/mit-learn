# Generated by Django 4.2.9 on 2024-01-23 15:44

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("learning_channels", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="fieldchannel",
            name="created_on",
            field=models.DateTimeField(auto_now_add=True, db_index=True),
        ),
        migrations.AlterField(
            model_name="fieldchannelgrouprole",
            name="created_on",
            field=models.DateTimeField(auto_now_add=True, db_index=True),
        ),
        migrations.AlterField(
            model_name="fieldlist",
            name="created_on",
            field=models.DateTimeField(auto_now_add=True, db_index=True),
        ),
        migrations.AlterField(
            model_name="subfield",
            name="created_on",
            field=models.DateTimeField(auto_now_add=True, db_index=True),
        ),
    ]