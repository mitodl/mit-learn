"""Add the PostHog event UUID column to LearningResourceViewEvent"""

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources", "0118_delete_micromasters_resources"),
    ]

    operations = [
        # Nullable column with no default: metadata-only, no table rewrite.
        # The unique index is built CONCURRENTLY in the next migration.
        # Pre-existing duplicate rows are left alone - they all have a NULL
        # event_uuid, which never conflicts in a unique index.
        migrations.AddField(
            model_name="learningresourceviewevent",
            name="event_uuid",
            field=models.UUIDField(
                editable=False,
                help_text=(
                    "The PostHog event UUID. Null only for rows loaded"
                    " before this field existed."
                ),
                null=True,
            ),
        ),
    ]
