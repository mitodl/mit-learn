"""Management command to run the content summarizer"""

from django.conf import settings
from django.core.management import BaseCommand

from learning_resources.content_summarizer import ContentSummarizer
from learning_resources.tasks import summarize_unprocessed_content
from main.utils import now_in_utc


class Command(BaseCommand):
    """Generate content summaries and flashcards and save them in database"""

    help = "Generate content summaries and flashcards"

    def add_arguments(self, parser):
        parser.add_argument(
            "--resource-ids",
            dest="resource-ids",
            help="Generate summaries and flashcards for a specific set of reesources",
        )
        parser.add_argument(
            "--read-only",
            dest="read_only",
            action="store_true",
            help="Read only mode to see how much data will be processed",
        )
        parser.add_argument(
            "--overwrite",
            dest="overwrite",
            action="store_true",
            help="Force overwrite existing embeddings",
        )
        parser.add_argument(
            "-c",
            "--chunk-size",
            dest="chunk_size",
            default=settings.CONTENT_FILE_SUMMARIER_CHUNK_SIZE,
            type=int,
            help="Chunk size for batch import task",
        )

        return super().add_arguments(parser)

    def handle(self, *args, **options):  # noqa: ARG002
        """Generate summaries and flashcards for content files"""
        read_only = options["read_only"]
        overwrite = options["overwrite"]
        resource_ids = options["resource-ids"]
        chunk_size = options["chunk_size"]

        summarizer_task = None

        if read_only:
            unprocessed_content_file_ids = (
                ContentSummarizer().get_unprocessed_content_file_ids(
                    learning_resource_ids=resource_ids, overwrite=overwrite
                )
            )
            self.stdout.write(
                f"Read-Only: {len(unprocessed_content_file_ids)} content files will be processed. ID(s): {unprocessed_content_file_ids}"  # noqa: E501
            )
        elif resource_ids:
            summarizer_task = summarize_unprocessed_content.delay(
                chunk_size=chunk_size,
                overwrite=overwrite,
                ids=[
                    int(resource_id)
                    for resource_id in options["resource-ids"].split(",")
                ],
            )
        else:
            summarizer_task = summarize_unprocessed_content.delay(
                chunk_size=chunk_size, overwrite=overwrite
            )

        if summarizer_task:
            self.stdout.write(
                f"Started celery task {summarizer_task} to run the content summarizer"
            )
            self.stdout.write("Waiting on task...")

            start = now_in_utc()
            stats = summarizer_task.get()
            self.stdout.write(f"Summarizer Stats: {stats}")

            total_seconds = (now_in_utc() - start).total_seconds()
            self.stdout.write(
                f"Content file summarizer finished, took {total_seconds} seconds"
            )
