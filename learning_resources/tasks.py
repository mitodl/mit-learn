"""
learning_resources tasks
"""

import logging
from datetime import UTC, datetime

import boto3
import celery
from django.conf import settings
from django.db.models import Count, Q
from django.utils import timezone

from learning_resources.content_summarizer import ContentSummarizer
from learning_resources.etl import pipelines, youtube
from learning_resources.etl.canvas import (
    sync_canvas_archive,
)
from learning_resources.etl.constants import MARKETING_PAGE_FILE_TYPE, ETLSource
from learning_resources.etl.edx_shared import (
    get_most_recent_course_archives,
    sync_edx_archive,
    sync_edx_course_files,
)
from learning_resources.etl.loaders import load_run_dependent_values
from learning_resources.etl.pipelines import ocw_courses_etl
from learning_resources.etl.utils import (
    get_bucket_by_name,
    get_s3_prefix_for_source,
)
from learning_resources.models import ContentFile, LearningResource
from learning_resources.site_scrapers.utils import scraper_for_site
from learning_resources.utils import (
    html_to_markdown,
    load_course_blocklist,
    resource_unpublished_actions,
    resource_upserted_actions,
)
from learning_resources_search.constants import COURSE_TYPE
from learning_resources_search.exceptions import RetryError
from main.celery import app
from main.constants import ISOFORMAT
from main.utils import chunks, clear_views_cache

log = logging.getLogger(__name__)


@app.task(bind=True)
def remove_duplicate_resources(self):
    """Remove duplicate unpublished resources"""
    from vector_search.tasks import generate_embeddings

    duplicates = (
        LearningResource.objects.values("readable_id")
        .annotate(count_id=Count("id"))
        .filter(count_id__gt=1)
    )
    embed_tasks = []
    for duplicate in duplicates:
        unpublished_resources = LearningResource.objects.filter(
            readable_id=duplicate["readable_id"],
            published=False,
        ).values_list("id", flat=True)
        published_resources = list(
            LearningResource.objects.filter(
                readable_id=duplicate["readable_id"],
                published=True,
            ).values_list("id", flat=True)
        )
        # keep the most recently created resource, delete the rest
        LearningResource.objects.filter(id__in=unpublished_resources).delete()
        embed_tasks.append(
            generate_embeddings.si(published_resources, COURSE_TYPE, overwrite=True)
        )
    self.replace(celery.chain(*embed_tasks))


@app.task
def update_next_start_date_and_prices():
    """Update expired next start dates and prices"""
    resources = LearningResource.objects.filter(next_start_date__lt=timezone.now())
    for resource in resources:
        load_run_dependent_values(resource)
        if resource.published:
            resource_upserted_actions(
                resource, percolate=False, generate_embeddings=True
            )
    clear_views_cache()
    return len(resources)


@app.task
def get_micromasters_data():
    """Execute the MicroMasters ETL pipeline"""
    programs = pipelines.micromasters_etl()
    clear_views_cache()
    return len(programs)


@app.task
def get_mit_edx_data(
    api_course_datafile: str | None = None,
    api_program_datafile: str | None = None,
) -> int:
    """Task to sync MIT edX data with the database

    Args:
        api_course_datafile (str): If provided, use file as source of course API data
            Otherwise, the API is queried directly.
        api_program_datafile (str): If provided, use file as source of program API data.
            Otherwise, the API is queried directly.

    Returns:
        int: The number of results that were fetched
    """
    courses = pipelines.mit_edx_courses_etl(api_course_datafile)
    programs = pipelines.mit_edx_programs_etl(api_program_datafile)
    clear_views_cache()
    return len(courses) + len(programs)


@app.task
def get_mitxonline_data() -> int:
    """Execute the MITX Online ETL pipeline"""
    courses = pipelines.mitxonline_courses_etl()
    programs = pipelines.mitxonline_programs_etl()
    clear_views_cache()
    return len(courses) + len(programs)


@app.task
def get_oll_data(sheets_id=None):
    """Execute the OLL ETL pipeline.

    Args:
        sheets_id (str): If provided, retrieved data from the
        google spreadsheet with this id.

    """
    courses = pipelines.oll_etl(sheets_id)
    clear_views_cache()
    return len(courses)


@app.task
def get_mitpe_data():
    """Execute the Professional Education ETL pipeline"""
    courses, programs = pipelines.mitpe_etl()
    return len(courses) + len(programs)


@app.task
def get_sloan_data():
    """Execute the Sloan ETL pipelines"""
    courses = pipelines.sloan_courses_etl()
    return len(courses)


@app.task
def get_xpro_data():
    """Execute the xPro ETL pipeline"""
    courses = pipelines.xpro_courses_etl()
    programs = pipelines.xpro_programs_etl()
    clear_views_cache()
    return len(courses) + len(programs)


@app.task
def get_mit_climate_data():
    """Execute the MIT Climate ETL pipeline"""
    articles = pipelines.mit_climate_etl()
    clear_views_cache()
    return len(articles)


@app.task
def get_content_files(
    ids: list[int],
    etl_source: str,
    keys: list[str],
    *,
    overwrite: bool = False,
):
    """
    Task to sync edX course content files with database
    """
    if not (
        settings.AWS_ACCESS_KEY_ID
        and settings.AWS_SECRET_ACCESS_KEY
        and settings.COURSE_ARCHIVE_BUCKET_NAME is not None
    ):
        log.warning("Required settings missing for %s files", etl_source)
        return
    sync_edx_course_files(etl_source, ids, keys, overwrite=overwrite)
    clear_views_cache()


def get_content_tasks(
    etl_source: str,
    *,
    chunk_size: int | None = None,
    overwrite: bool = False,
    learning_resource_ids: list[int] | None = None,
    # Updated parameter
) -> celery.group:
    """
    Return a list of grouped celery tasks for indexing edx content
    """
    if chunk_size is None:
        chunk_size = settings.LEARNING_COURSE_ITERATOR_CHUNK_SIZE

    blocklisted_ids = load_course_blocklist()
    archive_keys = get_most_recent_course_archives(etl_source)

    if learning_resource_ids:
        learning_resources = (
            LearningResource.objects.filter(
                id__in=learning_resource_ids, etl_source=etl_source
            )
            .order_by("-id")
            .values_list("id", flat=True)
        )
    else:
        learning_resources = (
            LearningResource.objects.filter(Q(published=True) | Q(test_mode=True))
            .filter(course__isnull=False, etl_source=etl_source)
            .exclude(readable_id__in=blocklisted_ids)
            .order_by("-id")
            .values_list("id", flat=True)
        )

    return celery.group(
        [
            get_content_files.si(ids, etl_source, archive_keys, overwrite=overwrite)
            for ids in chunks(
                learning_resources,
                chunk_size=chunk_size,
            )
        ]
    )


@app.task(bind=True)
def import_all_mit_edx_files(
    self, *, chunk_size=None, overwrite=False, learning_resource_ids=None
):
    """Ingest MIT edX files from an S3 bucket"""
    return self.replace(
        get_content_tasks(
            ETLSource.mit_edx.name,
            chunk_size=chunk_size,
            overwrite=overwrite,
            learning_resource_ids=learning_resource_ids,
        )
    )


@app.task(bind=True)
def import_all_oll_files(
    self, *, chunk_size=None, overwrite=False, learning_resource_ids=None
):
    """Ingest MIT edX files from an S3 bucket"""
    return self.replace(
        get_content_tasks(
            ETLSource.oll.name,
            chunk_size=chunk_size,
            overwrite=overwrite,
            learning_resource_ids=learning_resource_ids,
        )
    )


@app.task(bind=True)
def import_all_mitxonline_files(
    self, *, chunk_size=None, overwrite=False, learning_resource_ids=None
):
    """Ingest MITx Online files from an S3 bucket"""

    return self.replace(
        get_content_tasks(
            ETLSource.mitxonline.name,
            chunk_size=chunk_size,
            overwrite=overwrite,
            learning_resource_ids=learning_resource_ids,
        )
    )


@app.task(bind=True)
def import_all_xpro_files(
    self, *, chunk_size=None, overwrite=False, learning_resource_ids=None
):
    """Ingest xPRO OLX files from an S3 bucket"""

    return self.replace(
        get_content_tasks(
            ETLSource.xpro.name,
            chunk_size=chunk_size,
            overwrite=overwrite,
            learning_resource_ids=learning_resource_ids,
        )
    )


@app.task(bind=True)
def import_content_files(
    self, etl_source, *, chunk_size=None, overwrite=False, learning_resource_ids=None
):
    """Import content files for any edX-based ETL source.

    This task wraps get_content_tasks so that the S3 archive listing and
    task-group construction happen asynchronously in a Celery worker, rather
    than blocking the calling task.
    """
    return self.replace(
        get_content_tasks(
            etl_source,
            chunk_size=chunk_size,
            overwrite=overwrite,
            learning_resource_ids=learning_resource_ids,
        )
    )


@app.task
def get_podcast_data():
    """
    Execute the Podcast ETL pipeline

    Returns:
        int:
            The number of results that were fetched
    """
    results = pipelines.podcast_etl()
    clear_views_cache()
    return len(list(results))


@app.task(acks_late=True)
def get_ocw_courses(
    *,
    url_paths,
    force_overwrite,
    utc_start_timestamp=None,
    skip_content_files=settings.OCW_SKIP_CONTENT_FILES,
):
    """
    Task to sync a batch of OCW Next courses
    """
    if utc_start_timestamp:
        utc_start_timestamp = datetime.strptime(  # noqa: DTZ007
            utc_start_timestamp, ISOFORMAT
        )
        utc_start_timestamp = utc_start_timestamp.replace(tzinfo=UTC)

    ocw_courses_etl(
        url_paths=url_paths,
        force_overwrite=force_overwrite,
        start_timestamp=utc_start_timestamp,
        skip_content_files=skip_content_files,
    )
    clear_views_cache()


@app.task(bind=True, acks_late=True)
def get_ocw_data(  # noqa: PLR0913
    self,
    *,
    force_overwrite: bool | None = False,
    course_url_substring: str | None = None,
    utc_start_timestamp: datetime | None = None,
    prefix: str | None = None,
    skip_content_files: bool | None = settings.OCW_SKIP_CONTENT_FILES,
):
    """
    Task to sync OCW Next course data with database
    """
    if not (
        settings.AWS_ACCESS_KEY_ID
        and settings.AWS_SECRET_ACCESS_KEY
        and settings.OCW_LIVE_BUCKET
    ):
        log.warning("Required settings missing for get_ocw_data")
        return None

    # get all the courses prefixes we care about
    raw_data_bucket = boto3.resource(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    ).Bucket(name=settings.OCW_LIVE_BUCKET)

    ocw_courses = set()
    log.info("Assembling list of courses...")

    if not prefix:
        prefix = "courses/"

    if course_url_substring:
        prefix = prefix + course_url_substring + "/"

    for bucket_file in raw_data_bucket.objects.filter(Prefix=prefix):
        key_pieces = bucket_file.key.split("/")
        if "/".join(key_pieces[:2]) != "":
            path = "/".join(key_pieces[:2]) + "/"
            ocw_courses.add(path)

    if len(ocw_courses) == 0:
        log.info("No courses matching url substring")
        return None

    log.info("Backpopulating %d OCW courses...", len(ocw_courses))

    ocw_tasks = celery.group(
        [
            get_ocw_courses.si(
                url_paths=url_path,
                force_overwrite=force_overwrite,
                utc_start_timestamp=utc_start_timestamp,
                skip_content_files=skip_content_files,
            )
            for url_path in chunks(
                ocw_courses, chunk_size=settings.OCW_ITERATOR_CHUNK_SIZE
            )
        ]
    )
    return self.replace(ocw_tasks)


@app.task
def get_youtube_data(*, channel_ids=None):
    """
    Execute the YouTube ETL pipeline

    Args:
        channel_ids (list of str or None):
            if a list the extraction is limited to those channels

    Returns:
        int:
            The number of results that were fetched
    """
    results = pipelines.youtube_etl(channel_ids=channel_ids)
    clear_views_cache()
    return len(list(results))


@app.task
def get_youtube_transcripts(
    *, created_after=None, created_minutes=None, overwrite=False
):
    """
    Fetch transcripts for Youtube videos

    Args:
        created_after (date or None):
            if str, transcripts are pulled only for videos added after date
        created_minutes (int or None):
            if str, transcripts are pulled only from videos added >= created_minutes ago
        overwrite (bool):
            if true, transcripts are updated for videos that already have transcripts
    """

    videos = youtube.get_youtube_videos_for_transcripts_job(
        created_after=created_after,
        created_minutes=created_minutes,
        overwrite=overwrite,
    )

    log.info("Updating transcripts for %i videos", videos.count())
    youtube.get_youtube_transcripts(videos)
    clear_views_cache()


@app.task
def get_learning_resource_views():
    """Load learning resource views from the PostHog ETL."""

    pipelines.posthog_etl()
    clear_views_cache()


@app.task(acks_late=True)
def summarize_content_files_task(
    content_file_ids: list[int], *, overwrite: bool = False
):
    """Process a batch of content files to generate summary and flashcards.
    Args:
        - content_file_ids (list[int]): List of content file ids to process
        - overwrite (bool): Whether to overwrite existing summary and flashcards
    Returns:
        - None
    """
    summarizer = ContentSummarizer()
    return summarizer.summarize_content_files_by_ids(content_file_ids, overwrite)


@app.task(bind=True, acks_late=True)
def summarize_unprocessed_content(
    self,
    *,
    batch_size=None,
    unprocessed_content_ids: list[int],
    overwrite: bool = False,
):
    """Summarize the unprocessed content files.

    Args:
        - batch_size (int): Batch size for batch import task
        - unprocessed_content_ids (list[int]): List of resource ids to process
        - overwrite (bool): Force overwrite existing embeddings

    Returns:
        - None
    """

    if batch_size is None:
        batch_size = settings.CONTENT_FILE_SUMMARIZER_BATCH_SIZE

    summarizer_tasks = celery.group(
        [
            summarize_content_files_task.si(
                content_file_ids=content_ids, overwrite=overwrite
            )
            for content_ids in chunks(
                unprocessed_content_ids,
                chunk_size=batch_size,
            )
        ]
    )
    return self.replace(summarizer_tasks)


@app.task(acks_late=True)
def ingest_canvas_course(archive_path, overwrite):
    bucket = get_bucket_by_name(settings.COURSE_ARCHIVE_BUCKET_NAME)
    return sync_canvas_archive(bucket, archive_path, overwrite=overwrite)


@app.task(acks_late=True)
def ingest_edx_course(
    etl_source: str,
    archive_path: str,
    *,
    course_id: str | None = None,
    overwrite: bool = False,
):
    return sync_edx_archive(
        etl_source, archive_path, course_id=course_id, overwrite=overwrite
    )


@app.task(acks_late=True)
def sync_canvas_courses(canvas_course_ids, overwrite):
    """
    Sync all canvas course files

    Args:
        overwrite (bool): Whether to overwrite existing content files
    """

    bucket = get_bucket_by_name(settings.COURSE_ARCHIVE_BUCKET_NAME)
    s3_prefix = get_s3_prefix_for_source(ETLSource.canvas.name)
    exports = bucket.objects.filter(Prefix=s3_prefix)
    log.info("syncing all canvas courses")
    latest_archives = {}

    for archive in exports:
        key = archive.key
        course_folder = key.lstrip(settings.CANVAS_COURSE_BUCKET_PREFIX).split("/")[0]
        log.info("processing course folder %s", course_folder)

        if (
            key.endswith("imscc")
            and (not canvas_course_ids or course_folder in canvas_course_ids)
            and (
                (course_folder not in latest_archives)
                or max(
                    archive.last_modified, latest_archives[course_folder].last_modified
                )
                == archive.last_modified
            )
        ):
            latest_archives[course_folder] = archive
    canvas_readable_ids = []

    for archive in latest_archives.values():
        key = archive.key
        log.info("Ingesting canvas course %s", key)
        resource_readable_id = ingest_canvas_course(
            key,
            overwrite=overwrite,
        )
        canvas_readable_ids.append(resource_readable_id)

    if not canvas_course_ids:
        stale_courses = LearningResource.objects.filter(
            etl_source=ETLSource.canvas.name
        ).exclude(readable_id__in=canvas_readable_ids)
        stale_courses.update(test_mode=False, published=False)
        [resource_unpublished_actions(resource) for resource in stale_courses]
        stale_courses.delete()


@app.task(bind=True)
def scrape_marketing_pages(self):
    """
    Scrape marketing pages (for programs and courses)
    and store them as content files if they dont exist
    """
    log.info("Running scrape_marketing_pages task")
    resource_ids = set(
        LearningResource.objects.filter(
            published=True, resource_type__in=["course", "program"]
        ).values_list("id", flat=True)
    )

    existing_page_resource_ids = set(
        ContentFile.objects.filter(file_type="marketing_page").values_list(
            "learning_resource_id", flat=True
        )
    )
    missing_pages = list(resource_ids.difference(existing_page_resource_ids))

    tasks = [
        marketing_page_for_resources.si(ids)
        for ids in chunks(
            missing_pages,
            chunk_size=settings.QDRANT_CHUNK_SIZE,
        )
    ]
    scrape_tasks = celery.group(tasks)
    return self.replace(scrape_tasks)


@app.task(
    acks_late=True,
    reject_on_worker_lost=True,
    autoretry_for=(RetryError,),
    retry_backoff=True,
    rate_limit=settings.CELERY_RATE_LIMIT,
)
def marketing_page_for_resources(resource_ids):
    for learning_resource in LearningResource.objects.filter(id__in=resource_ids):
        marketing_page_url = learning_resource.url
        scraper = scraper_for_site(marketing_page_url)
        page_content = scraper.scrape()
        if page_content:
            content_file, _ = ContentFile.objects.update_or_create(
                learning_resource=learning_resource,
                file_type=MARKETING_PAGE_FILE_TYPE,
                defaults={
                    "file_extension": ".md",
                },
            )
            content_file.key = marketing_page_url
            content_file.url = marketing_page_url
            content_file.content = html_to_markdown(page_content)
            content_file.save()
