"""Management command for populating MITx course run file data"""

from django.conf import settings
from django.core.management import BaseCommand

from learning_resources.tasks import import_all_mit_edx_files
from main.utils import now_in_utc


class Command(BaseCommand):
    """Populate MIT edX course run files"""

    help = "Populate MIT edX course run files"

    def add_arguments(self, parser):
        parser.add_argument(
            "-c",
            "--chunk-size",
            dest="chunk_size",
            default=settings.LEARNING_COURSE_ITERATOR_CHUNK_SIZE,
            type=int,
            help="Chunk size for batch import task",
        )
        parser.add_argument(
            "--overwrite",
            dest="force_overwrite",
            action="store_true",
            help="Overwrite any existing records",
        )

        parser.add_argument(
            "--resource-ids",
            dest="learning_resource_ids",
            required=False,
            help="If set, backpopulate only the learning resources with these ids",
        )

    def handle(self, *args, **options):  # noqa: ARG002
        """Run Populate MIT edX course run files"""
        chunk_size = options["chunk_size"]
        resource_ids = (
            options["learning_resource_ids"].split(",")
            if options["learning_resource_ids"]
            else None
        )
        task = import_all_mit_edx_files.delay(
            chunk_size=chunk_size,
            overwrite=options["force_overwrite"],
            learning_resource_ids=resource_ids,
        )
        self.stdout.write(f"Started task {task} to get MIT edX course run file data")
        self.stdout.write("Waiting on task...")
        start = now_in_utc()
        task.get()
        total_seconds = (now_in_utc() - start).total_seconds()
        self.stdout.write(
            f"Population of MIT edX file data finished, took {total_seconds} seconds"
        )
