"""Management command for populating MITx course run file data"""

from django.core.management import BaseCommand

from learning_resources.tasks import sync_canvas_courses
from main.utils import now_in_utc


class Command(BaseCommand):
    """Populate Canvas courses from S3"""

    help = "Populate Canvas courses from S3"

    def add_arguments(self, parser):
        """Add arguments to the command"""
        parser.add_argument(
            "--overwrite",
            dest="force_overwrite",
            action="store_true",
            help="Force regenerate existing summaries/flashcards",
        )

    def handle(self, *args, **options):  # noqa: ARG002
        """Populate Canvas courses from S3"""

        task = sync_canvas_courses.delay(
            overwrite=options["force_overwrite"],
        )
        self.stdout.write(f"Started task {task} to get courses from Canvas")
        self.stdout.write("Waiting on task...")
        start = now_in_utc()
        task.get()
        total_seconds = (now_in_utc() - start).total_seconds()
        self.stdout.write(
            f"Population of Canvas file data finished, took {total_seconds} seconds"
        )
