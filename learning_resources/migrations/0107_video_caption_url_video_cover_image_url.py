# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources", "0106_resource_category_choices_index"),
    ]

    operations = [
        migrations.AddField(
            model_name="video",
            name="caption_urls",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="video",
            name="cover_image_url",
            field=models.URLField(blank=True, max_length=2048),
        ),
    ]
