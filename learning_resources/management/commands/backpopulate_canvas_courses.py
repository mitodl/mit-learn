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

        parser.add_argument(
            "--canvas-ids",
            dest="canvas_ids",
            required=False,
            help="""
              If set, backpopulate only the canvas courses with these ids.
              The canvas id is the number in the url for the course on canvas
              or the numerical part at the start of the readable_id.
              Example: https://canvas.mit.edu/courses/1234567 -> 1234567
              Example: readable_id 1234567-foobar -> 1234567
            """,
        )

    def handle(self, *args, **options):  # noqa: ARG002
        """Populate Canvas courses from S3"""
        canvas_ids = options["canvas_ids"].split(",") if options["canvas_ids"] else None

        task = sync_canvas_courses.delay(
            canvas_course_ids=canvas_ids,
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
