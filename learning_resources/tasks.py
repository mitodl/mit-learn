"""
learning_resources tasks
"""

import logging
from datetime import UTC, datetime
from typing import Optional

import boto3
import celery
from django.conf import settings
from django.utils import timezone

from learning_resources.content_summarizer import ContentSummarizer
from learning_resources.etl import pipelines, youtube
from learning_resources.etl.constants import ETLSource
from learning_resources.etl.edx_shared import (
    get_most_recent_course_archives,
    sync_edx_course_files,
)
from learning_resources.etl.loaders import load_run_dependent_values
from learning_resources.etl.pipelines import ocw_courses_etl
from learning_resources.etl.utils import get_learning_course_bucket_name
from learning_resources.models import LearningResource
from learning_resources.utils import load_course_blocklist
from main.celery import app
from main.constants import ISOFORMAT
from main.utils import chunks, clear_search_cache

log = logging.getLogger(__name__)


@app.task
def update_next_start_date_and_prices():
    """Update expired next start dates and prices"""
    resources = LearningResource.objects.filter(next_start_date__lt=timezone.now())
    for resource in resources:
        load_run_dependent_values(resource)
    clear_search_cache()
    return len(resources)


@app.task
def get_micromasters_data():
    """Execute the MicroMasters ETL pipeline"""
    programs = pipelines.micromasters_etl()
    clear_search_cache()
    return len(programs)


@app.task
def get_mit_edx_data(
    api_course_datafile: str | None = None, api_program_datafile: str | None = None
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
    clear_search_cache()
    return len(courses) + len(programs)


@app.task
def get_mitxonline_data() -> int:
    """Execute the MITX Online ETL pipeline"""
    courses = pipelines.mitxonline_courses_etl()
    programs = pipelines.mitxonline_programs_etl()
    clear_search_cache()
    return len(courses) + len(programs)


@app.task
def get_oll_data(sheets_id=None):
    """Execute the OLL ETL pipeline.

    Args:
        sheets_id (str): If provided, retrieved data from the
        google spreadsheet with this id.

    """
    courses = pipelines.oll_etl(sheets_id)
    clear_search_cache()
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
    clear_search_cache()
    return len(courses) + len(programs)


@app.task
def get_content_files(
    ids: list[int],
    etl_source: str,
    keys: list[str],
    *,
    s3_prefix: str | None = None,
    overwrite: bool = False,
):
    """
    Task to sync edX course content files with database
    """
    if not (
        settings.AWS_ACCESS_KEY_ID
        and settings.AWS_SECRET_ACCESS_KEY
        and get_learning_course_bucket_name(etl_source) is not None
    ):
        log.warning("Required settings missing for %s files", etl_source)
        return
    sync_edx_course_files(
        etl_source, ids, keys, s3_prefix=s3_prefix, overwrite=overwrite
    )
    clear_search_cache()


def get_content_tasks(
    etl_source: str,
    *,
    chunk_size: int | None = None,
    s3_prefix: str | None = None,
    override_base_prefix: bool = False,
    overwrite: bool = False,
) -> celery.group:
    """
    Return a list of grouped celery tasks for indexing edx content
    """
    if chunk_size is None:
        chunk_size = settings.LEARNING_COURSE_ITERATOR_CHUNK_SIZE

    blocklisted_ids = load_course_blocklist()
    archive_keys = get_most_recent_course_archives(
        etl_source, s3_prefix=s3_prefix, override_base_prefix=override_base_prefix
    )
    return celery.group(
        [
            get_content_files.si(
                ids, etl_source, archive_keys, s3_prefix=s3_prefix, overwrite=overwrite
            )
            for ids in chunks(
                LearningResource.objects.filter(
                    published=True, course__isnull=False, etl_source=etl_source
                )
                .exclude(readable_id__in=blocklisted_ids)
                .order_by("-id")
                .values_list("id", flat=True),
                chunk_size=chunk_size,
            )
        ]
    )


@app.task(bind=True)
def import_all_mit_edx_files(self, *, chunk_size=None, overwrite=False):
    """Ingest MIT edX files from an S3 bucket"""
    return self.replace(
        get_content_tasks(
            ETLSource.mit_edx.name,
            chunk_size=chunk_size,
            s3_prefix=settings.EDX_LEARNING_COURSE_BUCKET_PREFIX,
            overwrite=overwrite,
        )
    )


@app.task(bind=True)
def import_all_oll_files(self, *, chunk_size=None, overwrite=False):
    """Ingest MIT edX files from an S3 bucket"""
    return self.replace(
        get_content_tasks(
            ETLSource.oll.name,
            chunk_size=chunk_size,
            s3_prefix=settings.OLL_LEARNING_COURSE_BUCKET_PREFIX,
            override_base_prefix=True,
            overwrite=overwrite,
        )
    )


@app.task(bind=True)
def import_all_mitxonline_files(self, *, chunk_size=None, overwrite=False):
    """Ingest MITx Online files from an S3 bucket"""
    return self.replace(
        get_content_tasks(
            ETLSource.mitxonline.name, chunk_size=chunk_size, overwrite=overwrite
        )
    )


@app.task(bind=True)
def import_all_xpro_files(self, *, chunk_size=None, overwrite=False):
    """Ingest xPRO OLX files from an S3 bucket"""

    return self.replace(
        get_content_tasks(
            ETLSource.xpro.name, chunk_size=chunk_size, overwrite=overwrite
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
    clear_search_cache()
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
    clear_search_cache()


@app.task(bind=True, acks_late=True)
def get_ocw_data(  # noqa: PLR0913
    self,
    *,
    force_overwrite: Optional[bool] = False,
    course_url_substring: Optional[str] = None,
    utc_start_timestamp: Optional[datetime] = None,
    prefix: Optional[str] = None,
    skip_content_files: Optional[bool] = settings.OCW_SKIP_CONTENT_FILES,
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
    clear_search_cache()
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
    clear_search_cache()


@app.task
def get_learning_resource_views():
    """Load learning resource views from the PostHog ETL."""

    pipelines.posthog_etl()


def get_unprocessed_content_file_tasks(
    overwrite,
    chunk_size: int | None = None,
    ids: Optional[list[int]] = None,
) -> celery.group:
    """Generate task groups for processing unprocessed content files."""

    # If no Ids were provided, get all the unprocessed content file ids
    if not ids:
        ids = ContentSummarizer().get_unprocessed_content_file_ids(overwrite=overwrite)

    if chunk_size is None:
        chunk_size = settings.CONTENT_FILE_SUMMARIER_CHUNK_SIZE

    return celery.group(
        [
            process_single_content_file_task.si(unpreocess_lr_ids, overwrite)
            for unpreocess_lr_ids in chunks(
                ids,
                chunk_size=chunk_size,
            )
        ]
    )


@app.task(bind=True)
def summarize_unprocessed_content(
    self, *, chunk_size=None, overwrite, ids: Optional[list[int]] = None
):
    """Summarize the unprocessed content files."""

    return self.replace(
        get_unprocessed_content_file_tasks(
            overwrite=overwrite, ids=ids, chunk_size=chunk_size
        )
    )


@app.task
def process_single_content_file_task(ids: list[int], overwrite):
    """Process a single content file to generate summary and flashcards."""
    summarizer = ContentSummarizer()
    return summarizer.process_content_files_by_ids(ids, overwrite)
