"""Management command to run the content summarizer"""

from django.core.management import BaseCommand

from learning_resources.tasks import process_content_file_summarization
from main.utils import now_in_utc


class Command(BaseCommand):
    help = "Generate content summaries and flashcards"

    def handle(self, *args, **options):  # noqa: ARG002
        """Generate summaries and flashcards for content files"""
        summarizer_task = process_content_file_summarization.apply_async()

        self.stdout.write(
            f"Started celery task {summarizer_task} to run the content summarizer"
        )

        self.stdout.write("Waiting on task...")

        start = now_in_utc()
        stats = summarizer_task.get(disable_sync_subtasks=False)
        self.stdout.write(f"Summarizer Stats: {stats}")

        total_seconds = (now_in_utc() - start).total_seconds()
        self.stdout.write(
            f"Content file summarizer finished, took {total_seconds} seconds"
        )
