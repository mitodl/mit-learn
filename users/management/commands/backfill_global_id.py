"""Management command for reporting on and repairing users missing a global_id"""

from django.contrib.auth import get_user_model
from django.core.management import BaseCommand
from django.db.models import Count, Exists, F, OuterRef, Q

User = get_user_model()

DEFAULT_BATCH_SIZE = 5_000
SAMPLE_SIZE = 10

# global_id is a nullable CharField, so it can be missing as either NULL or blank
MISSING_GLOBAL_ID = Q(global_id__isnull=True) | Q(global_id="")
HAS_SCIM_EXTERNAL_ID = Q(scim_external_id__isnull=False) & ~Q(scim_external_id="")


def users_missing_global_id():
    """Users with no usable global_id"""
    return User.objects.filter(MISSING_GLOBAL_ID)


def repairable_users():
    """Users missing a global_id that have a scim_external_id to copy from"""
    return users_missing_global_id().filter(HAS_SCIM_EXTERNAL_ID)


def global_id_taken():
    """
    Match users whose scim_external_id is already some other user's global_id.

    An indexed probe against the unique global_id index, one row at most.
    """
    return Exists(User.objects.filter(global_id=OuterRef("scim_external_id")))


def scim_external_id_shared():
    """
    Match users sharing a scim_external_id with another user missing a global_id.

    An indexed probe against scim_external_id. Both users are left alone, since
    there is no way to tell from here which of them owns the id.
    """
    return Exists(
        User.objects.filter(
            MISSING_GLOBAL_ID, scim_external_id=OuterRef("scim_external_id")
        ).exclude(pk=OuterRef("pk"))
    )


def has_conflict():
    """
    global_id is unique, so copying this user's scim_external_id would collide.

    Deliberately expressed as per-row indexed subqueries rather than as an
    aggregate over the whole table: at a million users a GROUP BY over every
    duplicate scim_external_id is far more expensive than two index probes per
    candidate row, and it cannot be evaluated incrementally batch by batch.
    """
    return Q(global_id_taken()) | Q(scim_external_id_shared())


def percent(count, total):
    """Format count as a percentage of total"""
    if not total:
        return "n/a"
    return f"{count / total * 100:.1f}%"


class Command(BaseCommand):
    """Report on and repair users missing a global_id"""

    help = __doc__

    def add_arguments(self, parser):
        """Add the check and fix subcommands"""
        subparsers = parser.add_subparsers(dest="subcommand", required=True)

        check_parser = subparsers.add_parser(
            "check", help="Report on users missing a global_id, without changing them"
        )
        check_parser.add_argument(
            "--skip-conflicts",
            action="store_true",
            help=(
                "skip the conflicting scim_external_id analysis, which needs a "
                "second pass over the users missing a global_id"
            ),
        )

        fix_parser = subparsers.add_parser(
            "fix",
            help="Copy scim_external_id to global_id for users missing a global_id",
        )
        fix_parser.add_argument(
            "--batch-size",
            type=int,
            default=DEFAULT_BATCH_SIZE,
            help=f"number of users to update per query (default {DEFAULT_BATCH_SIZE})",
        )
        fix_parser.add_argument(
            "--start-id",
            type=int,
            default=0,
            help="resume from just after this user id",
        )

    def handle(self, *args, **options):  # noqa: ARG002
        """Run the requested subcommand"""
        if options["subcommand"] == "check":
            self._handle_check(skip_conflicts=options["skip_conflicts"])
        else:
            self._handle_fix(options["batch_size"], options["start_id"])

    def _handle_check(self, *, skip_conflicts):
        """Report stats on users missing a global_id"""
        # One pass over the users table for all three counts, rather than a
        # separate count query per line of the report
        counts = User.objects.aggregate(
            total=Count("id"),
            missing=Count("id", filter=MISSING_GLOBAL_ID),
            repairable=Count("id", filter=MISSING_GLOBAL_ID & HAS_SCIM_EXTERNAL_ID),
        )
        total = counts["total"]
        missing = counts["missing"]
        repairable = counts["repairable"]
        without_scim = missing - repairable

        self.stdout.write(f"Total users: {total}")
        self.stdout.write(
            f"Missing global_id: {missing} ({percent(missing, total)} of all users)"
        )
        self.stdout.write(
            f"  with scim_external_id: {repairable} "
            f"({percent(repairable, missing)} of those missing global_id)"
        )
        self.stdout.write(
            f"  without scim_external_id: {without_scim} "
            f"({percent(without_scim, missing)} of those missing global_id) "
            f"- cannot be fixed by this command"
        )

        if skip_conflicts:
            self.stdout.write(
                f"Fixable by the fix subcommand: at most {repairable}, "
                f"minus any conflicting scim_external_ids (not checked)"
            )
            return

        conflicted = repairable_users().aggregate(
            conflicted=Count("id", filter=has_conflict())
        )["conflicted"]
        self.stdout.write(f"Fixable by the fix subcommand: {repairable - conflicted}")

        if conflicted:
            self.stdout.write(
                self.style.WARNING(
                    f"Conflicting scim_external_ids: {conflicted} user(s) have a "
                    f"scim_external_id that is already another user's global_id, or "
                    f"that they share with another user missing a global_id. "
                    f"global_id is unique, so fix skips these and they need manual "
                    f"resolution."
                )
            )
            self._write_conflict_sample(conflicted)

    def _write_conflict_sample(self, conflicted):
        """Print a few conflicting users and why each one conflicts"""
        sample = (
            repairable_users()
            .annotate(taken=global_id_taken(), shared=scim_external_id_shared())
            .filter(Q(taken=True) | Q(shared=True))
            .order_by("id")
            .values_list("id", "scim_external_id", "taken", "shared")[:SAMPLE_SIZE]
        )
        for user_id, scim_external_id, taken, shared in sample:
            reasons = []
            if taken:
                reasons.append("already another user's global_id")
            if shared:
                reasons.append("shared with another user missing a global_id")
            self.stdout.write(
                f"  user {user_id}: {scim_external_id} ({', '.join(reasons)})"
            )
        if conflicted > SAMPLE_SIZE:
            self.stdout.write(f"  ...and {conflicted - SAMPLE_SIZE} more")

    def _handle_fix(self, batch_size, start_id):
        """Copy scim_external_id to global_id where it is safe to do so"""
        self.stdout.write("Copying scim_external_id to global_id")

        candidates = repairable_users().order_by("id")
        last_id = start_id
        fixed = 0
        skipped = 0

        # Paginate by primary key rather than re-running the candidate query
        # from the top each time: the id cursor always moves forward, so the
        # whole run is a single forward walk of the table, and it terminates
        # whether or not a given batch updates anything. Each batch commits on
        # its own, so an interrupted run can be resumed with --start-id.
        while batch_ids := list(
            candidates.filter(id__gt=last_id).values_list("id", flat=True)[:batch_size]
        ):
            last_id = batch_ids[-1]
            updated = (
                User.objects.filter(id__in=batch_ids)
                .exclude(has_conflict())
                .update(global_id=F("scim_external_id"))
            )
            fixed += updated
            skipped += len(batch_ids) - updated
            self.stdout.write(
                f"  fixed {fixed}, skipped {skipped} (through user id {last_id})"
            )

        self.stdout.write(self.style.SUCCESS(f"Fixed {fixed} user(s)"))
        self.stdout.write(
            f"Skipped {skipped} user(s) with a conflicting scim_external_id "
            f"(needs manual resolution)"
        )

        counts = User.objects.aggregate(
            missing=Count("id", filter=MISSING_GLOBAL_ID),
            repairable=Count("id", filter=MISSING_GLOBAL_ID & HAS_SCIM_EXTERNAL_ID),
        )
        self.stdout.write(f"Users still missing global_id: {counts['missing']}")
        self.stdout.write(
            f"  with scim_external_id: {counts['repairable']} "
            f"(conflicting values, or created since this run started)"
        )
        self.stdout.write(
            f"  without scim_external_id: {counts['missing'] - counts['repairable']}"
        )
