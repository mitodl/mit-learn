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
        """Add arguments to the command"""

        parser.add_argument(
            "--resource-ids",
            dest="resource-ids",
            help="Generate summaries/flashcards for specific set of learning resources. (Comma separated Ids)",  # noqa: E501
        )
        parser.add_argument(
            "--content-file-ids",
            dest="content-file-ids",
            help="Generate summaries/flashcards for specific set of content files. (Comma separated Ids)",  # noqa: E501
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
            help="Force regenerate existing summaries/flashcards",
        )
        parser.add_argument(
            "-b",
            "--batch-size",
            dest="batch_size",
            default=settings.CONTENT_FILE_SUMMARIZER_BATCH_SIZE,
            type=int,
            help="Batch size for summarizer task",
        )

        return super().add_arguments(parser)

    def handle(self, *args, **options):  # noqa: ARG002
        """Generate summaries and flashcards for content files"""
        read_only = options["read_only"]
        overwrite = options["overwrite"]
        resource_ids = (
            options["resource-ids"].split(",") if options["resource-ids"] else None
        )
        content_file_ids = (
            options["content-file-ids"].split(",")
            if options["content-file-ids"]
            else None
        )
        batch_size = options["batch_size"]

        summarizer_task = None
        summarizer = ContentSummarizer()
        unprocessed_content_file_ids = summarizer.get_unprocessed_content_file_ids(
            learning_resource_ids=resource_ids,
            content_file_ids=content_file_ids,
            overwrite=overwrite,
        )
        if read_only:
            self.stdout.write(
                f"Read-Only Mode: ({len(unprocessed_content_file_ids)}) content files will be processed with Id(s): {unprocessed_content_file_ids}"  # noqa: E501
            )
        else:
            summarizer_task = summarize_unprocessed_content.delay(
                unprocessed_content_ids=unprocessed_content_file_ids,
                batch_size=batch_size,
                overwrite=overwrite,
            )

        if summarizer_task:
            self.stdout.write(
                f"Started celery task {summarizer_task} to run the content summarizer"
            )
            self.stdout.write(
                f"Processing {len(unprocessed_content_file_ids)} content file(s)"
            )
            self.stdout.write("Waiting on task...")

            start = now_in_utc()
            summarizer_task.get()

            total_seconds = (now_in_utc() - start).total_seconds()
            self.stdout.write(
                f"Content file summarizer finished, took {total_seconds} seconds"
            )
