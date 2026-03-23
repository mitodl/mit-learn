"""Management command for populating ocw course learning materials"""

from django.core.management import BaseCommand

from learning_resources.tasks import update_ocw_learning_material_resources
from main.utils import now_in_utc


class Command(BaseCommand):
    """Populate OCW learning material resources"""

    help = "Populate OCW learning material resources"

    def handle(self, *args, **options):  # noqa: ARG002
        """Populate OCW learning material resources"""
        start = now_in_utc()
        task = update_ocw_learning_material_resources.delay()
        self.stdout.write(
            "Starting to update learning material resources for OCW courses"
        )
        task.get()
        total_seconds = (now_in_utc() - start).total_seconds()
        self.stdout.write(
            "Finished updating learning material resources for OCW courses"
            f", took {total_seconds} seconds."
        )
