from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources", "0137_etl_shadow_run"),
    ]

    operations = [
        migrations.AddField(
            model_name="claimextraction",
            name="published",
            field=models.BooleanField(default=False),
        ),
    ]
