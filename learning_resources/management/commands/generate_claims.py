"""Management command for generating resource profile claims"""

from django.core.management import BaseCommand, CommandError

from learning_resources.tasks import (
    generate_all_claims,
    unit_claims_resource_ids,
)


class Command(BaseCommand):
    """
    Generate resource profile claims for resources' best runs.

    Only step 1, the claims for the context unit, units and bins, exists so
    far; later steps will run from here too.
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

    def handle(self, *args, **options):  # noqa: ARG002
        """Queue claim generation"""
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
        task = generate_all_claims.delay(resource_ids, overwrite=options["overwrite"])
        self.stdout.write(
            f"Started task {task} to generate claims for"
            f" {len(resource_ids)} resource(s). Follow the celery logs for progress."
        )
