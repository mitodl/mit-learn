"""Management command for generating resource profile unit claims"""

from django.core.management import BaseCommand, CommandError

from learning_resources.tasks import (
    generate_all_unit_claims,
    unit_claims_resource_ids,
)


class Command(BaseCommand):
    """Generate resource profile claims for the units of courses' best runs"""

    help = (
        "Generate resource profile claims for the context unit, units and bins"
        " of courses' best runs"
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--resource-id",
            dest="resource_ids",
            action="append",
            type=int,
            help="Generate for this course only. Repeatable.",
        )
        parser.add_argument(
            "--all",
            dest="all",
            action="store_true",
            help="Generate for every published course with units",
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
        """Queue unit claim generation"""
        if options["all"]:
            resource_ids = unit_claims_resource_ids()
        elif options["resource_ids"]:
            resource_ids = options["resource_ids"]
        else:
            msg = "Pass --resource-id or --all"
            raise CommandError(msg)
        if not resource_ids:
            self.stdout.write("No courses have units to generate claims for")
            return
        task = generate_all_unit_claims.delay(
            resource_ids, overwrite=options["overwrite"]
        )
        self.stdout.write(
            f"Started task {task} to generate unit claims for"
            f" {len(resource_ids)} course(s). Follow the celery logs for progress."
        )
