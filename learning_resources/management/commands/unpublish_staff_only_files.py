"""Unpublish edX content files that sit under staff-only OLX subtrees"""

from django.core.management import BaseCommand

from learning_resources.etl.constants import ETLSource
from learning_resources.tasks import unpublish_all_staff_only_files
from main import settings
from main.utils import now_in_utc

EDX_SOURCES = [
    ETLSource.mitxonline.name,
    ETLSource.mit_edx.name,
    ETLSource.xpro.name,
    ETLSource.oll.name,
]


class Command(BaseCommand):
    """
    Walk each course's current archive and unpublish content files under
    visible_to_staff_only subtrees, then deindex them. Nothing is re-extracted
    or re-embedded.
    """

    help = "Unpublish staff-only edX content files from existing archives"

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
        """Run the unpublish tasks"""
        resource_ids = (
            options["learning_resource_ids"].split(",")
            if options["learning_resource_ids"]
            else None
        )
        start = now_in_utc()
        for source in options["sources"] or EDX_SOURCES:
            task = unpublish_all_staff_only_files.delay(
                etl_source=source,
                chunk_size=options["chunk_size"],
                learning_resource_ids=resource_ids,
            )
            self.stdout.write(f"Started task {task} for {source}, waiting...")
            results = task.get()
            total = sum(count or 0 for count in results or [])
            self.stdout.write(f"{source}: unpublished {total} content files")
        total_seconds = (now_in_utc() - start).total_seconds()
        self.stdout.write(f"Finished in {total_seconds} seconds")
