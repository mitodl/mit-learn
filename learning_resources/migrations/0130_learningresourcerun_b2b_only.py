"""
Add `b2b_only` beside `is_b2b`, and take `is_b2b` out of the model (expand).

Deploys are rolling and migrate before the new pods start, so for a few minutes
pods running the previous release query the migrated database. Each deploy has
to leave the previous release's queries valid:

- `b2b_only` gets a database default, because the previous release inserts runs
  without it.
- `is_b2b` stays in the database, because the previous release still selects
  it. It leaves Django's model state here, so this release never selects or
  writes it, and gets a database default so this release can insert without it.

Dropping `is_b2b` is a separate migration in a later release, once no deployed
code references it -- expand, then contract.

`b2b_only` is not copied from `is_b2b`: the two mean different things (`is_b2b`
is any run with a contract, `b2b_only` is a contract-only run), and the next
mitxonline ETL run sets it. Until then visibility is unaffected, since it is
decided by `published` and `is_variant`, which the ETL writes alongside it.
"""

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources", "0129_etlsourceownership"),
    ]

    operations = [
        migrations.AddField(
            model_name="learningresourcerun",
            name="b2b_only",
            field=models.BooleanField(default=False, db_default=False),
        ),
        migrations.AlterField(
            model_name="learningresourcerun",
            name="is_b2b",
            field=models.BooleanField(default=False, db_default=False, db_index=True),
        ),
        # State only: the column stays for the previous release, and is dropped
        # in a later migration.
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.RemoveField(model_name="learningresourcerun", name="is_b2b"),
            ],
        ),
    ]
