from django.conf import settings
from django.core.management.base import CommandError

from learning_resources.models import LearningResource, LearningResourceRun


class TestResourceConfigurationMixin:
    """
    Mixing that configures test resources in etl management commands
    """

    def configure_test_resources(self, options):
        # test mode should be false if the course has since been published
        LearningResource.objects.filter(published=True, test_mode=True).update(
            test_mode=False
        )
        if options.get("test_ids"):
            test_ids = options["test_ids"].split(",")
            LearningResourceRun.objects.filter(
                learning_resource__id__in=test_ids
            ).update(published=True)
            LearningResource.objects.filter(id__in=test_ids).update(
                test_mode=True, published=False
            )


class ConfirmDeleteMixin:
    """
    Mixin that prompts the user to confirm deletion when --delete is passed
    to a management command. The command class must define a --delete option.
    """

    def execute(self, *args, **options):
        if options.get("delete"):
            answer = input(
                f"Are you sure you want to use the --delete option in "
                f"{settings.ENVIRONMENT}? [y/N]: "
            )
            if answer.strip().lower() not in ("y", "yes"):
                msg = "Aborted."
                raise CommandError(msg)
        return super().execute(*args, **options)


class TestResourceIdMixin(TestResourceConfigurationMixin):
    """
    Mixin to add a --test-ids argument to management commands
    """

    def add_arguments(self, parser):
        parser.add_argument(
            "--test-ids",
            dest="test_ids",
            help="List of readable IDs to use for testing",
        )
