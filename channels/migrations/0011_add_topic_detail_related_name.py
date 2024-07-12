# Generated by Django 4.2.13 on 2024-07-10 16:43

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources", "0055_alter_relationship_options_ordering"),
        ("channels", "0010_alter_channel_name_regex"),
    ]

    operations = [
        migrations.AlterField(
            model_name="channeltopicdetail",
            name="topic",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="channel_topic_details",
                to="learning_resources.learningresourcetopic",
            ),
        ),
    ]