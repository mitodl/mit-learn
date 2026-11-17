"""Link SCIM-provisioned users to their Keycloak subject by setting global_id"""

from django.contrib.auth import get_user_model
from django.core.management import BaseCommand
from django.db import IntegrityError, transaction
from django.db.models import Exists, F, OuterRef
from keycloak.exceptions import KeycloakGetError
from mitol.keycloak import api as keycloak_api

from main.utils import now_in_utc

User = get_user_model()

HTTP_NOT_FOUND = 404


def unlinked_users():
    """Return users with no global_id whose SCIM external id could supply one"""
    return User.objects.filter(
        global_id__isnull=True, scim_external_id__isnull=False
    ).exclude(scim_external_id="")


def claimed_elsewhere():
    """Match a row whose external id is already another row's global_id"""
    return Exists(User.objects.filter(global_id=OuterRef("scim_external_id")))


def shared_with_unlinked():
    """Match a row whose external id is also on another unlinked row"""
    return Exists(
        unlinked_users()
        .filter(scim_external_id=OuterRef("scim_external_id"))
        .exclude(pk=OuterRef("pk"))
    )


def linkable_users():
    """Return the unlinked users whose external id names only them"""
    return unlinked_users().exclude(claimed_elsewhere()).exclude(shared_with_unlinked())


class Command(BaseCommand):
    """
    Set global_id from scim_external_id for users that SCIM provisioned
    without one.

    mitol-django-scim releases before global_id was stamped on create left the
    Keycloak subject only in scim_external_id. The APISIX middleware links such
    a row when its user logs in, but most never have, so they stay invisible to
    anything that looks users up by global_id.

    Rows whose external id is already another row's global_id, or is shared
    with another unlinked row, are skipped and listed. Those are duplicate
    accounts for one Keycloak subject: linking one of them by id order would
    pick an account arbitrarily, so they need a merge, not a link.
    """

    help = __doc__

    def add_arguments(self, parser):
        """Add command arguments"""
        parser.add_argument(
            "--batch-size",
            type=int,
            default=1000,
            help="Number of rows to update per transaction",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would change without writing",
        )
        parser.add_argument(
            "--verify-sample",
            type=int,
            default=0,
            metavar="N",
            help=(
                "Look up N random candidates in Keycloak and report how many "
                "name a live user, then exit without writing"
            ),
        )

    def handle(self, *args, **options):  # noqa: ARG002
        """Report duplicates, then sample, dry-run, or backfill"""
        candidates = unlinked_users()
        claimed = list(
            candidates.filter(claimed_elsewhere()).values_list("id", "scim_external_id")
        )
        shared = list(
            candidates.filter(shared_with_unlinked())
            .exclude(claimed_elsewhere())
            .order_by("scim_external_id", "id")
            .values_list("id", "scim_external_id")
        )
        self.stdout.write(
            f"{candidates.count()} users have no global_id and a SCIM external id. "
            f"Skipping {len(claimed)} whose id is another user's global_id and "
            f"{len(shared)} that share their id with another unlinked user."
        )
        for user_id, external_id in claimed:
            self.stdout.write(
                f"  needs merge: user_id={user_id} {external_id} is another "
                "user's global_id"
            )
        for user_id, external_id in shared:
            self.stdout.write(
                f"  needs merge: user_id={user_id} {external_id} is on another "
                "unlinked user"
            )

        if options["verify_sample"]:
            self.verify_sample(options["verify_sample"])
            return
        if options["dry_run"]:
            return

        updated, conflicts = self.backfill(options["batch_size"])
        self.stdout.write(
            f"Set global_id on {updated} users; {len(conflicts)} conflicted "
            "with a concurrent write"
        )
        for user_id, external_id in conflicts:
            self.stdout.write(
                f"  backfill_global_id_conflict: user_id={user_id} {external_id}"
            )

    def verify_sample(self, size):
        """Check that a random sample of external ids names a Keycloak user"""
        client = keycloak_api.get_admin_client()
        sample = (
            linkable_users().order_by("?").values_list("id", "scim_external_id")[:size]
        )
        missing = []
        for user_id, external_id in sample:
            try:
                client.get_user(external_id)
            except KeycloakGetError as exc:
                if exc.response_code != HTTP_NOT_FOUND:
                    raise
                missing.append((user_id, external_id))
        self.stdout.write(
            f"{len(sample) - len(missing)} of {len(sample)} sampled external ids "
            "name a Keycloak user"
        )
        for user_id, external_id in missing:
            self.stdout.write(f"  not in Keycloak: user_id={user_id} {external_id}")

    def backfill(self, batch_size):
        """
        Link candidates in primary key order, one transaction per batch.

        A batch can still hit the global_id unique constraint if another row
        takes one of its ids after the batch is selected (e.g. a SCIM PUT sets
        global_id from externalId). That batch is rolled back and retried row
        by row, so only the conflicting rows are skipped.

        :returns: the number of rows linked, and the (id, external id) pairs
            that conflicted
        """
        updated = 0
        conflicts = []
        last_id = 0
        while True:
            batch = list(
                linkable_users()
                .filter(id__gt=last_id)
                .order_by("id")
                .values_list("id", "scim_external_id")[:batch_size]
            )
            if not batch:
                return updated, conflicts
            last_id = batch[-1][0]
            try:
                with transaction.atomic():
                    updated += self.link(
                        User.objects.filter(id__in=[user_id for user_id, _ in batch])
                    )
            except IntegrityError:
                for user_id, external_id in batch:
                    try:
                        with transaction.atomic():
                            updated += self.link(User.objects.filter(id=user_id))
                    except IntegrityError:
                        conflicts.append((user_id, external_id))
            self.stdout.write(f"Linked {updated} users so far (through id {last_id})")

    def link(self, users):
        """Set global_id on the rows of users that are still unlinked"""
        return users.filter(global_id__isnull=True).update(
            global_id=F("scim_external_id"), updated_on=now_in_utc()
        )
