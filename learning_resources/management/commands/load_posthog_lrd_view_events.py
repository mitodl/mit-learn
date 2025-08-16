"""Management command to run the PostHog lrd_view pipeline."""

from django.core.management import BaseCommand

from learning_resources.models import LearningResourceViewEvent
from learning_resources.tasks import get_learning_resource_views


class Command(BaseCommand):
    """Run the PostHog ETL pipeline to import Learning Resource view events."""

    help = "Run the PostHog ETL pipeline to import Learning Resource view events."

    def handle(self, *args, **kwargs):  # noqa: ARG002
        """Run the PostHog ETL pipeline to import Learning Resource view events."""

        self.stdout.write("Running the ETL pipeline...")

        task = get_learning_resource_views.delay()
        task.get()

        ev_count = LearningResourceViewEvent.objects.count()

        self.stdout.write(f"Completed. {ev_count} view events total.")
