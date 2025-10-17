"""Management command for populating MITx course run file data"""

from django.core.management import BaseCommand

from learning_resources.tasks import get_mit_climate_data
from main.utils import now_in_utc


class Command(BaseCommand):
    """Populate Canvas courses from S3"""

    help = "Populate MIT Climate Articles"

    def handle(self, *args, **options):  # noqa: ARG002
        """Populate Canvas courses from S3"""

        task = get_mit_climate_data.delay()
        self.stdout.write(f"Started task {task} to get MIT climate articles")
        self.stdout.write("Waiting on task...")
        start = now_in_utc()
        task.get()
        total_seconds = (now_in_utc() - start).total_seconds()
        self.stdout.write(
            f"Population of Climate articles finished, took {total_seconds} seconds"
        )
