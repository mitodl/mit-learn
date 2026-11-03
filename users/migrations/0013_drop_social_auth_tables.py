from django.db import migrations

SOCIAL_TABLES = (
    "social_auth_usersocialauth",
    "social_auth_association",
    "social_auth_code",
    "social_auth_nonce",
    "social_auth_partial",
)


class Migration(migrations.Migration):
    """
    Drop the tables python-social-auth left behind.

    With social_django out of INSTALLED_APPS, Django no longer collects
    social_auth_usersocialauth rows when cascading a User delete, but the
    database still enforces that table's foreign key to users_user. The
    constraint is NO ACTION DEFERRABLE INITIALLY DEFERRED, so deleting a user
    that still has a legacy row raised IntegrityError at commit. Django admin
    and the ORM are the only paths that hard-delete a user; SCIM and
    retire_user both only deactivate.

    The other four tables carry no user reference and are dropped here only
    because nothing reads them any more.

    Irreversible by design: reversing would recreate empty tables, which is
    not the state anyone reverting to would want. The rows hold pre-SCIM OIDC
    UIDs from the ol-oidc backend, superseded by User.global_id since
    0009_user_global_id_assign_scim.
    """

    dependencies = [
        ("users", "0012_user_is_sso_user"),
    ]

    operations = [
        migrations.RunSQL(
            sql=[
                f"DROP TABLE IF EXISTS {', '.join(SOCIAL_TABLES)} CASCADE;",
                "DELETE FROM django_migrations WHERE app = 'social_django';",
            ],
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
