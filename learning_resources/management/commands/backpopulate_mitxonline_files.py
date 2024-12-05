"""Management command for populating mitxonline course run file data"""

from django.core.management import BaseCommand

from learning_resources.tasks import import_all_mitxonline_files
from main import settings
from main.utils import now_in_utc


class Command(BaseCommand):
    """Populate mitxonline course run files"""

    help = "Populate mitxonline course run files"

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

    def handle(self, *args, **options):  # noqa: ARG002
        """Run Populate MITX Online course run files"""
        chunk_size = options["chunk_size"]
        task = import_all_mitxonline_files.delay(
            chunk_size=chunk_size, overwrite=options["force_overwrite"]
        )
        self.stdout.write(
            f"Started task {task} to get MITX Online course run file data"
        )
        self.stdout.write("Waiting on task...")
        start = now_in_utc()
        task.get()
        total_seconds = (now_in_utc() - start).total_seconds()
        self.stdout.write(
            "Population of MITX Online file data finished, "
            f"took {total_seconds} seconds"
        )
