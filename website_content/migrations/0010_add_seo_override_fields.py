"""
Add the SEO override columns beside the existing ones, and seed them (expand).

Deploys are rolling: the Django pods restart over a window rather than all at
once, so for a few minutes old code and new code run against the same database.
Renaming the columns would take `seo_title` away from pods still selecting it,
and those would 500 until they restarted.

So this adds the new columns and copies the old values into them, leaving
`seo_title` and `seo_description` in place for the old code to keep reading.
Dropping them is a separate migration in a separate PR, once every pod is on
the new code -- expand, then contract.

One known gap in that window, and the reason it is a window rather than a
plan: a write served by an old pod lands in the old column, which the new code
does not read. Nothing 500s and nothing committed is lost, but an SEO override
edited during the deploy may need re-entering.
"""

from django.db import migrations, models
from django.db.models import F


def copy_overrides_forward(apps, schema_editor):
    """Seed the new columns from the ones they replace."""
    website_content = apps.get_model("website_content", "WebsiteContent")
    # The historical model carries a plain manager rather than the model's
    # SafeDeleteManager, so this covers soft-deleted rows as well -- which it
    # has to: undeleting one later must not come back with its SEO blanked.
    website_content.objects.update(
        seo_title_override=F("seo_title"),
        seo_description_override=F("seo_description"),
    )


def copy_overrides_back(apps, schema_editor):
    """
    Put the values back where the old code reads them.

    For a rollback between this migration and the one that drops the old
    columns: anything written to an override in the meantime belongs in the old
    column again, or unapplying this would lose it.
    """
    website_content = apps.get_model("website_content", "WebsiteContent")
    website_content.objects.update(
        seo_title=F("seo_title_override"),
        seo_description=F("seo_description_override"),
    )


class Migration(migrations.Migration):
    dependencies = [
        ("website_content", "0009_add_seo_fields_to_websitecontent"),
    ]

    operations = [
        migrations.AddField(
            model_name="websitecontent",
            name="seo_title_override",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="websitecontent",
            name="seo_description_override",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.RunPython(copy_overrides_forward, copy_overrides_back),
    ]
