from learning_resources.models import LearningResource


class BaseCommandMixin:
    def add_arguments(self, parser):
        parser.add_argument(
            "--test-ids",
            dest="test_ids",
            help="List of readable IDs to use for testing",
        )

    def configure_test_resources(self, options):
        if options.get("test_ids"):
            test_ids = options["test_ids"].split(",")
            LearningResource.objects.filter(id__in=test_ids).update(
                test_mode=True, published=False
            )
