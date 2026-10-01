"""
Rename the SEO fields to say that they are overrides.

The columns hold what the editor wants *instead of* what the content already
says, and the resolved values are now inferred when they are blank -- so the
names that read as "the SEO title" belong to the serializer's computed fields,
not to storage. A rename rather than a new pair of columns: the data is the
same data, and anything already written was always an override.
"""

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("website_content", "0009_add_seo_fields_to_websitecontent"),
    ]

    operations = [
        migrations.RenameField(
            model_name="websitecontent",
            old_name="seo_title",
            new_name="seo_title_override",
        ),
        migrations.RenameField(
            model_name="websitecontent",
            old_name="seo_description",
            new_name="seo_description_override",
        ),
    ]
