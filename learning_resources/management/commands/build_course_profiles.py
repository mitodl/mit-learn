"""Management command for loading stored claims into course profiles"""

from collections import Counter

from django.core.management import BaseCommand, CommandError

from learning_resources.models import ClaimExtraction


class Command(BaseCommand):
    """
    Build course profiles from the published run extractions already stored.

    This is step 3 of resource profile generation on its own: it makes no
    model calls, and generate_claims runs it after the run step anyway. Use it
    for claims generated before profiles existed, or with --force to apply a
    change to how profiles are loaded.
    """

    help = "Build course profiles from stored, published claim extractions"

    def add_arguments(self, parser):
        parser.add_argument(
            "--resource-ids",
            dest="resource_ids",
            help="Build for these learning resources only. (Comma separated Ids)",
        )
        parser.add_argument(
            "--all",
            dest="all",
            action="store_true",
            help="Build for every course with a published run extraction",
        )
        parser.add_argument(
            "--force",
            dest="force",
            action="store_true",
            help="Rebuild profiles that are already current",
        )

    def handle(self, *args, **options):  # noqa: ARG002
        """Build the profiles"""
        # deferred: the claim modules import the AI libraries
        from learning_resources.profiles.course_profile import (
            publish_course_profile,
        )

        extractions = ClaimExtraction.objects.filter(
            level=ClaimExtraction.Level.RUN, published=True, run__isnull=False
        ).select_related("run__learning_resource")
        if options["resource_ids"]:
            try:
                resource_ids = [
                    int(resource_id)
                    for resource_id in options["resource_ids"].split(",")
                    if resource_id.strip()
                ]
            except ValueError as exc:
                msg = f"--resource-ids must be comma separated ids: {exc}"
                raise CommandError(msg) from exc
            extractions = extractions.filter(run__learning_resource_id__in=resource_ids)
        elif not options["all"]:
            msg = "Pass --resource-ids or --all"
            raise CommandError(msg)

        counts = Counter()
        for extraction in extractions.order_by("id"):
            resource = extraction.run.learning_resource
            try:
                built = publish_course_profile(
                    resource, extraction, force=options["force"]
                )
            except Exception as exc:  # noqa: BLE001
                counts["failed"] += 1
                self.stderr.write(f"{resource.readable_id}: {exc}")
                continue
            counts["built" if built else "unchanged"] += 1
        self.stdout.write(
            f"Profiles built: {counts['built']}, unchanged: {counts['unchanged']},"
            f" failed: {counts['failed']}"
        )
