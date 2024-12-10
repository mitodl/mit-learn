# Generated by Django 4.2.14 on 2024-08-01 20:31

from django.db import migrations


def unpublish_empty_topic_channels(apps, schema_editor):
    """
    Set a topic channel to unpublished if it has no published learning resources.
    """
    Channel = apps.get_model("learning_channels", "Channel")
    LearningResource = apps.get_model("learning_resources", "LearningResource")

    published_resources = LearningResource.objects.filter(
        published=True,
    )

    channels = Channel.objects.filter(published=True, channel_type="topic").exclude(
        topic_detail__topic__learningresource__in=published_resources
    )

    for channel in channels:
        channel.published = False
        channel.save()


class Migration(migrations.Migration):
    dependencies = [
        (
            "data_fixtures",
            "0007_topic_mappings_edx_add_programming_coding_to_computer_science",
        ),
    ]

    operations = [
        migrations.RunPython(unpublish_empty_topic_channels, migrations.RunPython.noop),
    ]
