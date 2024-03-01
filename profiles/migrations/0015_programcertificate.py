# Generated by Django 4.2.10 on 2024-02-28 18:29

from django.db import connection, migrations, models


def create_external_schema(apps, schema_editor):
    """
    Create the 'external' schema in postgres which
    will house readonly tables to house data from external sources
    """

    with connection.cursor() as cursor:
        cursor.execute(
            "CREATE SCHEMA IF NOT EXISTS external AUTHORIZATION CURRENT_USER"
        )


class Migration(migrations.Migration):
    dependencies = [
        ("profiles", "0014_profile_updated_at"),
    ]

    operations = [
        migrations.RunPython(create_external_schema, migrations.RunPython.noop),
        migrations.CreateModel(
            name="ProgramCertificate",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("user_edxorg_id", models.IntegerField(blank=True, null=True)),
                ("micromasters_program_id", models.IntegerField(blank=True, null=True)),
                ("mitxonline_program_id", models.IntegerField(blank=True, null=True)),
                (
                    "user_edxorg_username",
                    models.CharField(blank=True, max_length=256),
                ),
                (
                    "user_email",
                    models.CharField(blank=False, max_length=256),
                ),
                (
                    "program_title",
                    models.CharField(blank=False, max_length=256),
                ),
                (
                    "user_gender",
                    models.CharField(blank=True, max_length=256),
                ),
                (
                    "user_address_city",
                    models.CharField(blank=True, max_length=256),
                ),
                (
                    "user_first_name",
                    models.CharField(blank=True, max_length=256),
                ),
                (
                    "user_last_name",
                    models.CharField(blank=True, max_length=256),
                ),
                (
                    "user_full_name",
                    models.CharField(blank=True, max_length=256),
                ),
                (
                    "user_year_of_birth",
                    models.CharField(blank=True, max_length=256),
                ),
                (
                    "user_country",
                    models.CharField(blank=True, max_length=256),
                ),
                (
                    "user_address_postal_code",
                    models.CharField(blank=True, max_length=256),
                ),
                (
                    "user_street_address",
                    models.CharField(blank=True, max_length=256),
                ),
                (
                    "user_address_state_or_territory",
                    models.CharField(blank=True, max_length=256),
                ),
                (
                    "user_mitxonline_username",
                    models.CharField(blank=True, max_length=256),
                ),
                (
                    "program_completion_timestamp",
                    models.DateTimeField(blank=True, null=True),
                ),
            ],
            options={"db_table": "external.programcertificate", "managed": False},
        ),
    ]
