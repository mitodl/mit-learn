from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("website_content", "0006_add_deleted_to_websitecontent"),
    ]

    operations = [
        migrations.AlterField(
            model_name="websitecontent",
            name="slug",
            field=models.SlugField(blank=True, max_length=255, null=True),
        ),
        migrations.AddConstraint(
            model_name="websitecontent",
            constraint=models.UniqueConstraint(
                condition=models.Q(("deleted__isnull", True)),
                fields=("slug",),
                name="website_content_unique_slug_among_live",
            ),
        ),
    ]
