"""Management command for generating resource profile claims"""

from django.core.management import BaseCommand, CommandError

from learning_resources.tasks import (
    generate_all_claims,
    rebuild_resource_profiles,
    unit_claims_resource_ids,
)


class Command(BaseCommand):
    """
    Generate resource profile claims for resources' best runs, and load them
    into their resource profiles.
    """

    help = "Generate resource profile claims for resources' best runs"

    def add_arguments(self, parser):
        parser.add_argument(
            "--resource-ids",
            dest="resource_ids",
            help="Generate for these learning resources only. (Comma separated Ids)",
        )
        parser.add_argument(
            "--all",
            dest="all",
            action="store_true",
            help="Generate for every published resource with units",
        )
        parser.add_argument(
            "--overwrite",
            dest="overwrite",
            action="store_true",
            help=(
                "Regenerate claims that are already stored, to apply a prompt,"
                " model or code change"
            ),
        )
        parser.add_argument(
            "--rebuild-profiles",
            dest="rebuild_profiles",
            action="store_true",
            help=(
                "Only rebuild resource profiles from their published claims,"
                " without generating claims, to apply a change to the code"
                " that builds profiles. Makes no model calls."
            ),
        )

    def handle(self, *args, **options):  # noqa: ARG002
        """Queue claim generation, or profile rebuilds"""
        if options["rebuild_profiles"] and options["overwrite"]:
            msg = (
                "--rebuild-profiles doesn't generate claims, so it can't be"
                " combined with --overwrite"
            )
            raise CommandError(msg)
        if options["all"]:
            resource_ids = unit_claims_resource_ids()
        elif options["resource_ids"]:
            try:
                resource_ids = [
                    int(resource_id)
                    for resource_id in options["resource_ids"].split(",")
                    if resource_id.strip()
                ]
            except ValueError as exc:
                msg = f"--resource-ids must be comma separated ids: {exc}"
                raise CommandError(msg) from exc
        else:
            msg = "Pass --resource-ids or --all"
            raise CommandError(msg)
        if not resource_ids:
            self.stdout.write("No resources have units to generate claims for")
            return
        if options["rebuild_profiles"]:
            task = rebuild_resource_profiles.delay(resource_ids)
            self.stdout.write(
                f"Started task {task} to rebuild the profiles of"
                f" {len(resource_ids)} resource(s). Follow the celery logs for"
                " progress."
            )
            return
        task = generate_all_claims.delay(resource_ids, overwrite=options["overwrite"])
        self.stdout.write(
            f"Started task {task} to generate claims for"
            f" {len(resource_ids)} resource(s). Follow the celery logs for progress."
        )
