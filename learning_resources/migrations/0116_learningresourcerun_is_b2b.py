# Generated manually on 2026-07-06

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources", "0115_videoplaylist_parent_learning_resource"),
    ]

    operations = [
        migrations.AddField(
            model_name="learningresourcerun",
            name="is_b2b",
            field=models.BooleanField(db_index=True, default=False),
        ),
    ]
