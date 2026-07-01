# Generated manually
"""Replace invalid non-credit level keys on learning resource runs."""

from django.db import migrations

OLD_LEVEL = "non-credit"
NEW_LEVEL = "noncredit"


def replace_non_credit_level(apps, schema_editor):
    """Replace non-credit with noncredit in LearningResourceRun.level arrays."""
    LearningResourceRun = apps.get_model("learning_resources", "LearningResourceRun")

    matching_runs = LearningResourceRun.objects.filter(level__icontains=OLD_LEVEL)
    for run in matching_runs.iterator():
        updated_level = [
            NEW_LEVEL if level.lower() == OLD_LEVEL else level for level in run.level
        ]
        if updated_level != run.level:
            run.level = updated_level
            run.save(update_fields=["level"])


class Migration(migrations.Migration):
    """Normalize non-credit learning resource run levels."""

    dependencies = [
        ("data_fixtures", "0024_add_ovs_platform_offeror"),
        ("learning_resources", "0115_videoplaylist_parent_learning_resource"),
    ]

    operations = [
        migrations.RunPython(replace_non_credit_level, migrations.RunPython.noop),
    ]
