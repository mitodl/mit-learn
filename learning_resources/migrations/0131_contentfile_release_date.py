from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources", "0130_learningresourcerun_b2b_only"),
    ]

    operations = [
        migrations.AddField(
            model_name="contentfile",
            name="release_date",
            field=models.DateTimeField(
                blank=True,
                help_text=(
                    "When the course releases this file to learners; null if the "
                    "course does not gate it."
                ),
                null=True,
            ),
        ),
    ]
