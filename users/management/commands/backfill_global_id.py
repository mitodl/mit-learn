"""Link SCIM-provisioned users to their Keycloak subject by setting global_id"""

import logging

from django.contrib.auth import get_user_model
from django.core.management import BaseCommand
from django.db import IntegrityError, transaction
from django.db.models import Exists, F, OuterRef
from keycloak.exceptions import KeycloakGetError
from mitol.keycloak import api as keycloak_api

from main.utils import now_in_utc

log = logging.getLogger(__name__)

User = get_user_model()

HTTP_NOT_FOUND = 404


def unlinked_users():
    """Return users with no global_id whose SCIM external id could supply one"""
    return User.objects.filter(
        global_id__isnull=True, scim_external_id__isnull=False
    ).exclude(scim_external_id="")


def claimed_elsewhere():
    """Return an Exists() for another row already holding scim_external_id"""
    return Exists(User.objects.filter(global_id=OuterRef("scim_external_id")))


class Command(BaseCommand):
    """
    Set global_id from scim_external_id for users that SCIM provisioned
    without one.

    mitol-django-scim releases before global_id was stamped on create left the
    Keycloak subject only in scim_external_id. The APISIX middleware links such
    a row when its user logs in, but most never have, so they stay invisible to
    anything that looks users up by global_id.

    Rows whose external id is already another row's global_id are skipped and
    reported: those are duplicate accounts for one Keycloak subject and need a
    merge, not a link.
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
        """Report collisions, then sample, dry-run, or backfill"""
        candidates = unlinked_users()
        collisions = list(
            candidates.filter(claimed_elsewhere()).values_list("id", "scim_external_id")
        )
        self.stdout.write(
            f"{candidates.count()} users have no global_id and a SCIM external "
            f"id; {len(collisions)} of those ids already belong to another user"
        )
        for user_id, external_id in collisions:
            self.stdout.write(
                f"  skip user_id={user_id}: global_id {external_id} is held by "
                "another user"
            )

        if options["verify_sample"]:
            self.verify_sample(options["verify_sample"])
            return
        if options["dry_run"]:
            return

        updated, skipped = self.backfill(options["batch_size"])
        self.stdout.write(f"Set global_id on {updated} users, skipped {skipped}")

    def verify_sample(self, size):
        """Check that a random sample of external ids names a Keycloak user"""
        client = keycloak_api.get_admin_client()
        sample = (
            unlinked_users()
            .exclude(claimed_elsewhere())
            .order_by("?")
            .values_list("id", "scim_external_id")[:size]
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

        A batch that hits the global_id unique constraint (a login linked one
        of its ids since the batch was selected, or two unlinked rows share an
        external id) is retried row by row so only the conflicting rows are
        skipped.
        """
        updated = skipped = 0
        last_id = 0
        while True:
            batch = list(
                unlinked_users()
                .exclude(claimed_elsewhere())
                .filter(id__gt=last_id)
                .order_by("id")
                .values_list("id", flat=True)[:batch_size]
            )
            if not batch:
                return updated, skipped
            last_id = batch[-1]
            try:
                with transaction.atomic():
                    updated += self.link(User.objects.filter(id__in=batch))
            except IntegrityError:
                for user_id in batch:
                    try:
                        with transaction.atomic():
                            updated += self.link(User.objects.filter(id=user_id))
                    except IntegrityError:
                        skipped += 1
                        log.warning(
                            "backfill_global_id: global_id_linked_to_other_user "
                            "user_id=%s",
                            user_id,
                        )
            self.stdout.write(f"Linked {updated} users so far (through id {last_id})")

    def link(self, users):
        """Set global_id on the rows of users that are still unlinked"""
        return users.filter(global_id__isnull=True).update(
            global_id=F("scim_external_id"), updated_on=now_in_utc()
        )
