"""Management command for populating ocw course data"""

from django.conf import settings
from django.core.management import BaseCommand

from learning_resources.etl.constants import ETLSource
from learning_resources.management.commands.mixins import TestResourceConfigurationMixin
from learning_resources.models import LearningResource
from learning_resources.tasks import get_ocw_data
from learning_resources.utils import resource_delete_actions
from main.constants import ISOFORMAT
from main.utils import now_in_utc


class Command(TestResourceConfigurationMixin, BaseCommand):
    """Populate OCW learning resources"""

    help = "Populate OCW learning resources"

    def add_arguments(self, parser):
        parser.add_argument(
            "--overwrite",
            dest="force_overwrite",
            action="store_true",
            help="Overwrite any existing records",
        )
        parser.add_argument(
            "--delete",
            dest="delete",
            action="store_true",
            help="Delete existing records first",
        )
        parser.add_argument(
            "--course-name",
            dest="course_name",
            required=False,
            help="If set,backpopulate only the course with this ocw-studio name",
        )
        parser.add_argument(
            "--skip-contentfiles",
            dest="skip_content_files",
            action="store_true",
            help="Skip loading content files",
        )
        super().add_arguments(parser)

    def handle(self, *args, **options):  # noqa: ARG002
        """Run Populate OCW courses"""
        course_name = options.get("course_name")
        skip_content_files = (
            options.get("skip_content_files") or settings.OCW_SKIP_CONTENT_FILES
        )

        if options["delete"]:
            ocw_resources = LearningResource.objects.filter(
                etl_source=ETLSource.ocw.name
            )
            if course_name:
                ocw_resources = ocw_resources.filter(
                    runs__slug=f"courses/{course_name}"
                )

            self.stdout.write(f"Deleting OCW course(s) {course_name or ''}")
            for resource in ocw_resources:
                resource_delete_actions(resource)

        else:
            start = now_in_utc()
            task = get_ocw_data.delay(
                force_overwrite=options["force_overwrite"],
                course_url_substring=course_name,
                utc_start_timestamp=start.strftime(ISOFORMAT),
                skip_content_files=skip_content_files,
            )

            self.stdout.write(
                "Started task {task} to get ocw next course data "
                "w/force_overwrite={overwrite}, course_name={course_name}, "
                "skip_content_files={skip_content_files}".format(
                    task=task,
                    overwrite=options["force_overwrite"],
                    course_name=course_name,
                    skip_content_files=skip_content_files,
                )
            )
            self.stdout.write("Waiting on task...")
            task.get()
            self.configure_test_resources(options)
            total_seconds = (now_in_utc() - start).total_seconds()
            self.stdout.write(
                f"Population of ocw data finished, took {total_seconds} seconds."
            )
            self.stdout.write("See celery logs for details.")
