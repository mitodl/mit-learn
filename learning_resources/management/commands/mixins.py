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
