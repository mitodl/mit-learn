"""Management command for populating xpro course run file data"""

from django.conf import settings
from django.core.management import BaseCommand

from learning_resources.management.commands.mixins import BaseCommandMixin
from learning_resources.tasks import import_all_xpro_files
from main.utils import now_in_utc


class Command(BaseCommandMixin, BaseCommand):
    """Populate xpro course run files"""

    help = "Populate xpro course run files"

    def add_arguments(self, parser):
        super().add_arguments(parser)
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
        """Run Populate xpro course run files"""
        chunk_size = options["chunk_size"]
        resource_ids = (
            options["learning_resource_ids"].split(",")
            if options["learning_resource_ids"]
            else None
        )
        self.configure_test_resources(options)
        task = import_all_xpro_files.delay(
            chunk_size=chunk_size,
            overwrite=options["force_overwrite"],
            learning_resource_ids=resource_ids,
        )
        self.stdout.write(f"Started task {task} to get xpro course run file data")
        self.stdout.write("Waiting on task...")
        start = now_in_utc()
        task.get()
        total_seconds = (now_in_utc() - start).total_seconds()
        self.stdout.write(
            f"Population of xpro file data finished, took {total_seconds} seconds"
        )
