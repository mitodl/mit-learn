from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("profiles", "0039_remove_userwebsite"),
    ]

    operations = [
        migrations.AddField(
            model_name="programcertificate",
            name="is_revoked",
            field=models.BooleanField(default=False),
        ),
    ]
