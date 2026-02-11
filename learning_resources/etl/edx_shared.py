"""Shared functions for EdX sites"""

import logging
from pathlib import Path
from tarfile import ReadError
from tempfile import TemporaryDirectory

from django.conf import settings
from django.core.cache import caches
from django.db.models import Prefetch, Q

from learning_resources.etl.constants import ETLSource
from learning_resources.etl.loaders import load_content_files
from learning_resources.etl.utils import (
    calc_checksum,
    get_bucket_by_name,
    get_s3_prefix_for_source,
    transform_content_files,
)
from learning_resources.models import LearningResourceRun

log = logging.getLogger(__name__)

ETL_CACHE_TIMEOUT = 300
ARCHIVE_KEYS_CACHE_TIMEOUT = 300


def normalize_run_id(etl_source: str, run_id: str) -> str:
    """
    Normalize a run_id for in-memory matching.

    Args:
        etl_source(str): The ETL source, which determines the normalization rules
        run_id(str): The run_id to normalize

    Returns:
        str: The normalized run_id
    """
    if etl_source == ETLSource.mit_edx.name:
        normalized = run_id.replace("-", ".").replace("+", ".").lower()
        return normalized.removeprefix("course.v1:")
    elif etl_source == ETLSource.oll.name:
        normalized = (
            run_id.replace("-", ".").replace("_", ".").replace("+", ".").lower()
        )
        return normalized.removeprefix("course.v1:")
    return run_id


def extract_run_id_from_key(etl_source: str, key: str) -> str:
    """
    Extract and normalize a run_id from an S3 archive key path.

    Args:
        etl_source(str): The ETL source, which determines the extraction rules
        key(str): The S3 key path of the course archive

    Returns:
        str: The extracted and normalized run_id
    """
    if etl_source == ETLSource.oll.name:
        filename_only = key.split("/")[-1]
        raw = filename_only.split(".tar.gz")[0]
        raw = raw.replace("_OLL", "")
    else:
        raw = Path(key).parent.name.split("/")[-1]
    return normalize_run_id(etl_source, raw)


def build_run_lookup(
    etl_source: str, ids: list[int]
) -> dict[str, list[LearningResourceRun]]:
    """
    Batch-fetch all candidate LearningResourceRun objects and build a
    normalized run_id lookup dictionary.

    Args:
        etl_source(str): The ETL source
        ids(list of int): List of LearningResource IDs to filter by.
            If empty/falsy, all published/test_mode runs for the source
            are included.

    Returns:
        dict: Mapping of normalized run_id -> list of LearningResourceRun
    """
    runs = (
        LearningResourceRun.objects.filter(
            learning_resource__etl_source=etl_source,
        )
        .filter(Q(published=True) | Q(learning_resource__test_mode=True))
        .filter(
            Q(learning_resource__published=True) | Q(learning_resource__test_mode=True)
        )
        .select_related("learning_resource")
        .prefetch_related(
            Prefetch(
                "learning_resource__runs",
                queryset=LearningResourceRun.objects.filter(published=True),
                to_attr="_published_runs",
            )
        )
    )
    if ids:
        runs = runs.filter(learning_resource_id__in=ids)

    lookup: dict[str, list[LearningResourceRun]] = {}
    for run in runs:
        normalized = normalize_run_id(etl_source, run.run_id)
        lookup.setdefault(normalized, []).append(run)
    return lookup


def process_course_archive(
    bucket, key: str, run: LearningResourceRun, *, overwrite: bool = False
) -> None:
    """
    Download and process a course archive from S3.

    Args:
        bucket: S3 bucket object
        key(str): S3 object key for the course archive
        run(LearningResourceRun): The run to process
        overwrite(bool): Whether to overwrite existing content files

    Returns:
        bool: True if successfully processed, False if skipped due to matching checksum
    """
    with TemporaryDirectory() as export_tempdir:
        course_tarpath = Path(export_tempdir, key.split("/")[-1])
        log.info("course tarpath for run %s is %s", run.run_id, course_tarpath)
        bucket.download_file(key, course_tarpath)
        try:
            checksum = calc_checksum(course_tarpath)
        except ReadError:
            log.exception("Error reading tar file %s, skipping", course_tarpath)
            return False
        if run.checksum == checksum and not overwrite:
            log.info("Checksums match for %s, skipping load", key)
            return False
        try:
            load_content_files(
                run,
                transform_content_files(course_tarpath, run, overwrite=overwrite),
            )
            run.checksum = checksum
            run.save()
        except:  # noqa: E722
            log.exception("Error ingesting OLX content data for %s", key)


def get_most_recent_course_archives(etl_source: str) -> list[str]:
    """
    Retrieve a list of S3 keys for the most recent edx course archives.

    Results are cached for ARCHIVE_KEYS_CACHE_TIMEOUT seconds so that
    multiple tasks for the same etl_source don't each perform a full
    S3 bucket listing.

    Args:
        etl_source(str): The edx ETL source

    Returns:
        list of str: edx archive S3 keys
    """
    redis_cache = caches["redis"]
    cache_key = f"archive_keys_{etl_source}"
    cached = redis_cache.get(cache_key)
    if cached is not None:
        log.info("Using cached archive keys for %s", etl_source)
        return cached

    bucket = get_bucket_by_name(settings.COURSE_ARCHIVE_BUCKET_NAME)
    if not bucket:
        log.warning("No S3 bucket for platform %s", etl_source)
        return []
    s3_prefix = get_s3_prefix_for_source(etl_source)
    try:
        log.info("Getting recent archives from %s with prefix %s", bucket, s3_prefix)

        latest_archives = {}

        for archive in bucket.objects.filter(Prefix=s3_prefix):
            key = archive.key
            if etl_source == ETLSource.oll.name:
                course_id = key.split("/")[-1].split(".tar.gz")[0]
            else:
                course_id = Path(key).parent.name.split("/")[-1]
            if (course_id not in latest_archives) or max(
                archive.last_modified, latest_archives[course_id]["last_modified"]
            ) == archive.last_modified:
                latest_archives[course_id] = {
                    "key": archive.key,
                    "last_modified": archive.last_modified,
                }
        result = [entry["key"] for entry in latest_archives.values()]
        redis_cache.set(cache_key, result, timeout=ARCHIVE_KEYS_CACHE_TIMEOUT)
        return result  # noqa: TRY300
    except (StopIteration, IndexError):
        log.warning(
            "No %s exported courses found in S3 bucket %s", etl_source, bucket.name
        )
        return []


def trigger_resource_etl(etl_source):
    """
    Trigger an ETL process for all resources of a given source
    """
    from learning_resources import tasks

    redis_cache = caches["redis"]
    cache_key = f"etl_triggered_{etl_source}"
    if not redis_cache.add(cache_key, True, timeout=ETL_CACHE_TIMEOUT):  # noqa: FBT003
        log.info("ETL already triggered recently for %s, skipping", etl_source)
        return
    try:
        if etl_source == ETLSource.mit_edx.name:
            tasks.get_mit_edx_data.apply_async()
        elif etl_source == ETLSource.mitxonline.name:
            tasks.get_mitxonline_data.apply_async()
        elif etl_source == ETLSource.xpro.name:
            tasks.get_xpro_data.apply_async()
        else:
            log.warning(
                "No ETL pipeline for %s, cannot sync archive",
                etl_source,
            )
            redis_cache.delete(cache_key)
    except Exception:
        redis_cache.delete(cache_key)
        log.exception("Failed to trigger ETL for %s", etl_source)


def sync_edx_archive(
    etl_source, s3_key: str, *, course_id: str | None = None, overwrite: bool = False
):
    """
    Sync an edx course archive

    Args:
        etl_source(str): The edx ETL source
        s3_key(str): S3 path of the content archive
        overwrite(bool): Whether to overwrite existing content files
    """
    run = run_for_edx_archive(etl_source, s3_key, course_id=course_id)
    if not run:
        trigger_resource_etl(etl_source)
        return
    course = run.learning_resource
    if course.published and not course.test_mode and course.best_run != run:
        # This is not the best run for the published course, so skip it
        log.warning(
            "%s not the best run for %s, skipping", run.run_id, course.readable_id
        )
        return
    bucket = get_bucket_by_name(settings.COURSE_ARCHIVE_BUCKET_NAME)
    process_course_archive(bucket, s3_key, run, overwrite=overwrite)


def run_for_edx_archive(
    etl_source: str, archive_filename: str, course_id: str | None = None
):
    """
    Generate and return a LearningResourceRun for an edx course archive

    Args:
        etl_source(str): The edx ETL source
        archive_filename(str): The S3 key path of the course archive
        course_id(str): Optional course id to filter by

    Returns:
        LearningResourceRun or None: The matching run, or None if not found
    """
    normalized_run_id = extract_run_id_from_key(etl_source, archive_filename)
    runs = (
        LearningResourceRun.objects.filter(
            learning_resource__etl_source=etl_source,
        )
        .filter(Q(published=True) | Q(learning_resource__test_mode=True))
        .filter(
            Q(learning_resource__published=True) | Q(learning_resource__test_mode=True)
        )
    )
    if course_id:
        runs = runs.filter(learning_resource__readable_id=course_id)
    if etl_source in (ETLSource.mit_edx.name, ETLSource.oll.name):
        runs = runs.filter(run_id__iregex=normalized_run_id)
    else:
        runs = runs.filter(run_id=normalized_run_id)
    # There should be only 1 matching run per course archive, warn if not
    if runs.count() > 1:
        log.warning("There are %d runs for %s", runs.count(), normalized_run_id)
    return runs.first()


def sync_edx_course_files(
    etl_source: str,
    ids: list[int],
    keys: list[str],
    *,
    overwrite: bool = False,
):
    """
    Sync all edx course run files for a list of course ids to database

    Args:
        etl_source(str): The edx ETL source
        ids(list of int): list of course ids to process
        keys(list[str]): list of S3 archive keys to search through
    """
    bucket = get_bucket_by_name(settings.COURSE_ARCHIVE_BUCKET_NAME)
    run_lookup = build_run_lookup(etl_source, ids)

    for key in keys:
        normalized_key_id = extract_run_id_from_key(etl_source, key)
        matching_runs = run_lookup.get(normalized_key_id)

        if not matching_runs:
            log.debug("No runs found for %s, skipping", key)
            continue

        if len(matching_runs) > 1:
            log.warning("There are %d runs for %s", len(matching_runs), key)

        run = matching_runs[0]
        course = run.learning_resource

        if course.published and not course.test_mode and course.best_run != run:
            # This is not the best run for the published course, so skip it
            log.debug("Not the best run for %s, skipping", run.run_id)
            continue
        process_course_archive(bucket, key, run, overwrite=overwrite)
