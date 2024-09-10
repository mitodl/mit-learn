# Generated by Django 4.2.15 on 2024-09-10 12:23

from django.db import migrations, models


def set_ocw_license_cc(apps, schema_editor):
    """
    Set license_cc to True for OCW resources.
    """
    LearningResource = apps.get_model("learning_resources", "LearningResource")
    LearningResource.objects.filter(offered_by__code="ocw").update(license_cc=True)


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources", "0062_learningresource_delivery_format_pace"),
    ]

    operations = [
        migrations.AddField(
            model_name="learningresource",
            name="continuing_ed_credits",
            field=models.DecimalField(
                decimal_places=2, max_digits=5, blank=True, null=True
            ),
        ),
        migrations.AddField(
            model_name="learningresource",
            name="license_cc",
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(set_ocw_license_cc, migrations.RunPython.noop),
    ]
