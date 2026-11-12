from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources", "0140_claim_extraction_unit_parts"),
    ]

    operations = [
        migrations.AddField(
            model_name="resourceprofileconfiguration",
            name="max_parts",
            field=models.PositiveIntegerField(
                default=10,
                help_text="Most parts a unit over the input budget may be split"
                " into; each part is a call of its own. A unit that would need"
                " more is skipped. 1 turns splitting off. Only the unit and"
                " context stages use it.",
            ),
        ),
    ]
