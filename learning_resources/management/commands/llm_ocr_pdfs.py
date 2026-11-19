"""Management command to re-extract learning resource PDFs with LLM OCR"""

from urllib.parse import urlparse

from django.conf import settings
from django.core.management import BaseCommand, CommandError

from learning_resources.constants import LearningResourceType
from learning_resources.etl.constants import ETLSource
from learning_resources.models import ContentFile, LearningResource
from learning_resources.tasks import get_ocw_courses, import_content_files
from main.utils import now_in_utc

# sources whose content files come from OLX course archives
OLX_ETL_SOURCES = [
    ETLSource.mitxonline.name,
    ETLSource.xpro.name,
    ETLSource.oll.name,
]


def _parse_ids(values: list[str] | None) -> list[int]:
    """Parse ids given as separate arguments and/or comma separated"""
    try:
        return [int(part) for part in " ".join(values or []).replace(",", " ").split()]
    except ValueError as exc:
        msg = f"Invalid id list: {values}"
        raise CommandError(msg) from exc


def _ocw_url_path(resource: LearningResource) -> str | None:
    """Return the OCW bucket prefix of a course, e.g. courses/18-01-fall-2020/"""
    path = urlparse(resource.url or "").path.strip("/")
    return f"{path}/" if path.startswith("courses/") else None


def _pdfs(resource_ids):
    """Return the visible PDF content files of the resources' runs"""
    return ContentFile.objects.visible().filter(
        run__learning_resource_id__in=resource_ids,
        file_extension__iexact=".pdf",
    )


class Command(BaseCommand):
    """Re-extract the text of learning resources' PDFs with LLM OCR"""

    help = (
        "Re-run the content file ETL of specific courses, extracting their PDFs "
        "with the LLM OCR converter used for Canvas. Other files keep their "
        "stored text unless they changed. Supports OCW, MITx Online, xPRO and "
        "OLL courses. PDFs over OCR_PDF_MAX_PAGE_THRESHOLD pages, and PDFs OCR "
        "fails on or returns no text for, are extracted with tika instead. An "
        "invalid PDF falls back to tika for OCW, but for MITx Online, xPRO and "
        "OLL it is logged as a failure and keeps its stored text."
    )

    def add_arguments(self, parser):
        """Add arguments to the command"""
        parser.add_argument(
            "--resource-ids",
            dest="resource_ids",
            nargs="+",
            required=True,
            help="Learning resource ids, space or comma separated",
        )
        parser.add_argument(
            "--dry-run",
            dest="dry_run",
            action="store_true",
            help="Show what would be processed without processing it",
        )

    def handle(self, *args, **options):  # noqa: ARG002
        """Dispatch each resource to its source's content file ETL"""
        resource_ids = _parse_ids(options["resource_ids"])
        resources = LearningResource.objects.filter(id__in=resource_ids).in_bulk()
        missing = sorted(set(resource_ids) - set(resources))
        if missing:
            self.stderr.write(f"Learning resources not found: {missing}")

        tasks, dispatched = self._build_tasks(resources.values())
        if not tasks:
            self.stderr.write("Nothing to process")
            return
        if options["dry_run"]:
            return
        if not settings.OCR_MODEL:
            msg = "OCR_MODEL is not set, PDFs would be re-extracted with tika"
            raise CommandError(msg)

        start = now_in_utc()
        # dispatched one by one: these tasks replace themselves with their
        # fan-out, which is not reliably awaited from inside a group
        results = [task.delay() for task in tasks]
        for result in results:
            self.stdout.write(f"Waiting on celery task {result}...")
            result.get()
        self._report(dispatched, start)

    def _build_tasks(self, resources):
        """Return the ETL tasks for the resources and the ids they cover"""
        olx_ids: dict[str, list[int]] = {}
        ocw_paths: list[str] = []
        dispatched: list[LearningResource] = []
        for resource in resources:
            pdf_count = _pdfs([resource.id]).count()
            label = (
                f"{resource.id} {resource.readable_id} ({resource.etl_source}): "
                f"{pdf_count} PDF(s) currently loaded"
            )
            if resource.resource_type != LearningResourceType.course.name:
                self.stderr.write(
                    f"{label}: skipped, {resource.resource_type} resources are "
                    "not supported, only courses"
                )
                continue
            if resource.etl_source in OLX_ETL_SOURCES:
                olx_ids.setdefault(resource.etl_source, []).append(resource.id)
            elif resource.etl_source == ETLSource.ocw.name and (
                url_path := _ocw_url_path(resource)
            ):
                ocw_paths.append(url_path)
                label += f", bucket prefix {url_path}"
            elif resource.etl_source == ETLSource.canvas.name:
                self.stderr.write(
                    f"{label}: skipped, Canvas PDFs are already OCR'd "
                    "(backpopulate_canvas_courses --overwrite re-runs them)"
                )
                continue
            else:
                self.stderr.write(f"{label}: skipped, source not supported")
                continue
            dispatched.append(resource)
            self.stdout.write(label)

        tasks = [
            import_content_files.si(
                etl_source, learning_resource_ids=ids, ocr_pdfs=True
            )
            for etl_source, ids in olx_ids.items()
        ]
        if ocw_paths:
            tasks.append(
                get_ocw_courses.si(
                    url_paths=ocw_paths,
                    force_overwrite=False,
                    skip_content_files=False,
                    ocr_pdfs=True,
                )
            )
        return tasks, dispatched

    def _report(self, resources, start):
        """Write how many of each resource's PDFs were saved since start"""
        for resource in resources:
            pdfs = _pdfs([resource.id])
            updated = pdfs.filter(updated_on__gte=start).count()
            # a PDF OCR could not handle (too long, failed, blank, or invalid
            # for OCW) falls back to tika, so saved is not the same as OCR'd;
            # an invalid OLX PDF fails and is not saved
            self.stdout.write(
                f"{resource.id} {resource.readable_id}: "
                f"{updated} of {pdfs.count()} PDF(s) saved during this run"
            )
        total_seconds = (now_in_utc() - start).total_seconds()
        self.stdout.write(
            self.style.SUCCESS(f"LLM OCR finished, took {total_seconds} seconds")
        )
