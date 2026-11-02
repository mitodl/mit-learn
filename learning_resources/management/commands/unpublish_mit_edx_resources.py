"""Unpublish every mit_edx learning resource"""

from django.core.management import BaseCommand

from learning_resources.tasks import unpublish_mit_edx_resources


class Command(BaseCommand):
    """Unpublish every mit_edx learning resource"""

    help = "Unpublish every mit_edx learning resource"

    def handle(self, *args, **options):  # noqa: ARG002
        """Run the unpublish task and wait for it"""
        task = unpublish_mit_edx_resources.delay()
        self.stdout.write(f"Started task {task}, waiting...")
        task.get()
        self.stdout.write("Done")
