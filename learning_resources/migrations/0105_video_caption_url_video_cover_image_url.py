# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources", "0104_delete_learningmaterial"),
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
