"""Delete every mit_edx learning resource and remove the edx platform from search"""

from django.conf import settings
from django.core.management import BaseCommand, CommandError

from learning_resources.tasks import delete_mit_edx_data


class Command(BaseCommand):
    """Delete every mit_edx learning resource"""

    help = "Delete every mit_edx learning resource and remove edx from search"

    def add_arguments(self, parser):
        parser.add_argument(
            "--no-input",
            dest="no_input",
            action="store_true",
            help="Skip the confirmation prompt",
        )

    def handle(self, *args, **options):  # noqa: ARG002
        if not options["no_input"]:
            answer = input(
                "Delete every mit_edx learning resource in "
                f"{settings.ENVIRONMENT}? [y/N]: "
            )
            if answer.strip().lower() not in ("y", "yes"):
                msg = "Aborted."
                raise CommandError(msg)

        try:
            task = delete_mit_edx_data.delay()
            self.stdout.write(
                f"Started task {task.id}. It keeps running if this session "
                "drops; search the celery logs for this id to see how it ended."
            )
            counts = task.get()
        except RuntimeError as err:
            raise CommandError(str(err)) from err
        self.stdout.write(
            f"Deleted {counts['resources']} mit_edx resources, fixed "
            f"{counts['parents']} parents and {counts['user_lists']} user lists"
        )
