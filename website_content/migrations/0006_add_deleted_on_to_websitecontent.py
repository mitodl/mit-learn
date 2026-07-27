from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("website_content", "0005_add_cover_image_to_websitecontent"),
    ]

    operations = [
        migrations.AddField(
            model_name="websitecontent",
            name="deleted_on",
            field=models.DateTimeField(blank=True, default=None, null=True),
        ),
    ]
