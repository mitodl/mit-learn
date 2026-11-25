from django.db import migrations

# 0130 removed `is_b2b` from Django's state but left the column, because the
# release before it still selected it while pods rolled.
DROP = """
ALTER TABLE learning_resources_learningresourcerun DROP COLUMN is_b2b;
"""

# The column as 0116 and 0130 left it, so reversing 0130 finds it. Only the
# schema comes back, with every row false. Nothing has written `is_b2b` since
# 0130, and the code before 0130 sets it on every mitxonline ETL run.
RESTORE = """
ALTER TABLE learning_resources_learningresourcerun
    ADD COLUMN is_b2b boolean DEFAULT false NOT NULL;
CREATE INDEX learning_resources_learningresourcerun_is_b2b_f7412245
    ON learning_resources_learningresourcerun (is_b2b);
"""


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources", "0141_unit_run_position_idx"),
    ]

    operations = [
        migrations.RunSQL(DROP, reverse_sql=RESTORE),
    ]
