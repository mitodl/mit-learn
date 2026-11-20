from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources", "0142_practice_problem"),
    ]

    operations = [
        migrations.AddField(
            model_name="practiceproblem",
            name="context",
            field=models.TextField(
                blank=True,
                default="",
                help_text=(
                    "Material outside the problem that it cites (shared setup, "
                    "constants, an earlier problem) as markdown"
                ),
            ),
        ),
    ]
