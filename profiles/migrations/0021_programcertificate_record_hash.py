# Generated by Django 4.2.11 on 2024-04-01 20:48


from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("profiles", "0020_alter_programcertificate_options"),
    ]

    operations = [
        migrations.AddField(
            model_name="programcertificate",
            name="record_hash",
            field=models.CharField(max_length=256, editable=False, null=True),
        ),
    ]
