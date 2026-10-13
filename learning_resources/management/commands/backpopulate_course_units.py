"""Build course units for edX runs from their current archives"""

from operator import itemgetter

from django.core.management import BaseCommand

from learning_resources.management.commands.unpublish_excluded_files import (
    EDX_SOURCES,
)
from learning_resources.tasks import build_all_course_units
from main import settings
from main.utils import now_in_utc


class Command(BaseCommand):
    """
    Walk each course's current archive and rebuild its units, one per visible
    sequential plus a context unit, linking the run's published content files.
    Nothing is re-extracted or re-embedded.
    """

    help = "Build edX course units from existing archives"

    def add_arguments(self, parser):
        parser.add_argument(
            "--source",
            dest="sources",
            action="append",
            choices=EDX_SOURCES,
            help="ETL source to process (repeatable). Default: all edX sources",
        )
        parser.add_argument(
            "-c",
            "--chunk-size",
            dest="chunk_size",
            default=settings.LEARNING_COURSE_ITERATOR_CHUNK_SIZE,
            type=int,
            help="Chunk size for batch task",
        )
        parser.add_argument(
            "--resource-ids",
            dest="learning_resource_ids",
            required=False,
            help="If set, only process the learning resources with these ids",
        )

    def handle(self, *args, **options):  # noqa: ARG002
        """Run the unit tasks"""
        resource_ids = (
            options["learning_resource_ids"].split(",")
            if options["learning_resource_ids"]
            else None
        )
        start = now_in_utc()
        for source in options["sources"] or EDX_SOURCES:
            task = build_all_course_units.delay(
                etl_source=source,
                chunk_size=options["chunk_size"],
                learning_resource_ids=resource_ids,
            )
            self.stdout.write(f"Started task {task} for {source}, waiting...")
            rows = [row for chunk in task.get() or [] for row in chunk or []]
            for row in sorted(rows, key=itemgetter("run_id")):
                self.stdout.write(
                    f"{source} run {row['run_id']}: {row['units']} units linking "
                    f"{row['linked']} of {row['total']} published content files"
                )
            self.stdout.write(
                f"{source} summary: {sum(row['units'] for row in rows)} units "
                f"across {len(rows)} run(s), linking "
                f"{sum(row['linked'] for row in rows)} of "
                f"{sum(row['total'] for row in rows)} published content files"
            )

        total_seconds = (now_in_utc() - start).total_seconds()
        self.stdout.write(f"Finished in {total_seconds} seconds")
