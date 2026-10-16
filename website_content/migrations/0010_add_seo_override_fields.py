"""
Add the SEO override columns beside the existing ones, and seed them (expand).

Deploys are rolling and migrate before the new pods start, so for a few minutes
pods running the previous release query the migrated database. Each deploy has
to leave the previous release's queries valid:

- The new columns get a database default, because the previous release
  inserts rows without them.
- `seo_title` and `seo_description` stay in the database, because the previous
  release still selects them. They leave Django's model state here, and the
  model, so this release never selects or writes them; they get a database
  default for the same reason as above.

Dropping the old columns is a separate migration in a later release, once no
deployed code references them -- expand, then contract.

An override saved by a previous-release pod during the deploy lands in the old
column, which this release does not read, so it may need re-entering.
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
    Put the values back where the previous release reads them.

    For a rollback before the old columns are dropped: anything written to an
    override in the meantime belongs in the old column again, or unapplying
    this would lose it.
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
            field=models.CharField(
                blank=True, default="", db_default="", max_length=255
            ),
        ),
        migrations.AddField(
            model_name="websitecontent",
            name="seo_description_override",
            field=models.TextField(blank=True, default="", db_default=""),
        ),
        migrations.RunPython(copy_overrides_forward, copy_overrides_back),
        migrations.AlterField(
            model_name="websitecontent",
            name="seo_title",
            field=models.CharField(
                blank=True, default="", db_default="", max_length=255
            ),
        ),
        migrations.AlterField(
            model_name="websitecontent",
            name="seo_description",
            field=models.TextField(blank=True, default="", db_default=""),
        ),
        # State only: the columns stay for the previous release, and are
        # dropped in a later migration.
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.RemoveField(model_name="websitecontent", name="seo_title"),
                migrations.RemoveField(
                    model_name="websitecontent", name="seo_description"
                ),
            ],
        ),
    ]
