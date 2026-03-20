# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources", "0107_video_caption_url_video_cover_image_url"),
    ]

    operations = [
        migrations.AddField(
            model_name="video",
            name="streaming_url",
            field=models.URLField(
                blank=True,
                default="",
                help_text="HLS streaming URL (.m3u8) from OVS",
                max_length=2048,
            ),
        ),
    ]
