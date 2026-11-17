from django.db import migrations

# 0010 removed `seo_title` and `seo_description` from Django's state but left the
# columns, because the release before it still selected them while pods rolled.
DROP = """
ALTER TABLE website_content_websitecontent
    DROP COLUMN seo_title,
    DROP COLUMN seo_description;
"""

# The columns as 0009 and 0010 left them; reversing 0010 then copies the
# overrides back into them.
RESTORE = """
ALTER TABLE website_content_websitecontent
    ADD COLUMN seo_title varchar(255) DEFAULT '' NOT NULL,
    ADD COLUMN seo_description text DEFAULT '' NOT NULL;
"""


class Migration(migrations.Migration):
    dependencies = [
        ("website_content", "0010_add_seo_override_fields"),
    ]

    operations = [
        migrations.RunSQL(DROP, reverse_sql=RESTORE),
    ]
