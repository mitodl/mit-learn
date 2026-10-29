"""Set username to the lowercased email where it is something else."""

from django.db import migrations
from django.db.models import Exists, F, OuterRef
from django.db.models.functions import Length, Lower

UPDATE_BATCH_SIZE = 5000


def username_from_email(apps, schema_editor):
    """
    Set username to the lowercased email for every user where that can't collide.

    Keycloak lowercases usernames, and its username in the olapps realm is the
    email. scim-for-keycloak finds a user it has no stored id for with
    `userName eq "<email>"`, which compares against username exactly. A user
    whose username is anything else, including the email in another case,
    can't be found, so their SCIM operations fail with a 409 and retry
    indefinitely.

    Email isn't unique here, so a user is skipped when another account has the
    same email (ignoring case). A user is also skipped when their email is
    already another user's username (ignoring case), or is longer than the
    username column. Those rows need manual review.
    Updating one user can clear the way for another (their email was the first
    user's old username), so this repeats until a pass changes nothing.
    """
    User = apps.get_model("users", "User")
    max_length = User._meta.get_field("username").max_length  # noqa: SLF001
    others = User.objects.exclude(pk=OuterRef("pk"))
    while True:
        user_ids = list(
            User.objects.annotate(lower_email=Lower("email"))
            .exclude(email="")
            .exclude(username=F("lower_email"))
            .annotate(email_length=Length("email"))
            .filter(email_length__lte=max_length)
            .exclude(
                Exists(
                    others.annotate(lower_email=Lower("email")).filter(
                        lower_email=OuterRef("lower_email")
                    )
                )
            )
            .exclude(
                Exists(
                    others.annotate(lower_username=Lower("username")).filter(
                        lower_username=OuterRef("lower_email")
                    )
                )
            )
            .values_list("pk", flat=True)
        )
        if not user_ids:
            return
        for start in range(0, len(user_ids), UPDATE_BATCH_SIZE):
            User.objects.filter(
                pk__in=user_ids[start : start + UPDATE_BATCH_SIZE]
            ).update(username=Lower("email"))


class Migration(migrations.Migration):
    """Set username to the lowercased email where that can't collide."""

    # Each batch commits on its own, so a batch releases its row locks instead
    # of holding them until every pass is done. A rerun picks up where an
    # interrupted one stopped.
    atomic = False
    dependencies = [
        ("users", "0012_user_is_sso_user"),
    ]

    # The old usernames aren't kept, so this can't be reversed.
    operations = [migrations.RunPython(username_from_email, migrations.RunPython.noop)]
