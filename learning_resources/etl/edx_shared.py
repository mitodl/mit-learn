"""Shared functions for EdX sites"""

import logging
import re
from pathlib import Path
from tarfile import ReadError
from tempfile import TemporaryDirectory

from django.db.models import Q

from learning_resources.etl.constants import ETLSource
from learning_resources.etl.loaders import load_content_files
from learning_resources.etl.utils import (
    calc_checksum,
    get_learning_course_bucket,
    transform_content_files,
)
from learning_resources.models import LearningResource

log = logging.getLogger(__name__)

EDX_S3_BASE_PREFIX = "20"


def get_most_recent_course_archives(
    etl_source: str, *, s3_prefix: str | None = None, override_base_prefix=False
) -> list[str]:
    """
    Retrieve a list of S3 keys for the most recent edx course archives

    Args:
        etl_source(str): The edx ETL source
        s3_prefix(str): The prefix for S3 object keys
        override_base_prefix(bool): Override the default prefix of "20"

    Returns:
        list of str: edx archive S3 keys
    """
    bucket = get_learning_course_bucket(etl_source)
    if not bucket:
        log.warning("No S3 bucket for platform %s", etl_source)
        return []
    if s3_prefix is None:
        s3_prefix = "courses"
    try:
        log.info("Getting recent archives from %s with prefix %s", bucket, s3_prefix)
        course_tar_regex = (
            rf"{s3_prefix}/.*\.tar\.gz$"
            if override_base_prefix
            else rf".*/{s3_prefix}/.*\.tar\.gz$"
        )
        most_recent_export_file = next(
            reversed(  # noqa: C413
                sorted(
                    [
                        obj
                        for obj in bucket.objects.filter(
                            # Use s3_prefix for OLL, "20" for all others
                            Prefix=s3_prefix
                            if override_base_prefix
                            else EDX_S3_BASE_PREFIX
                        )
                        if re.search(course_tar_regex, obj.key)
                    ],
                    key=lambda obj: obj.last_modified,
                )
            )
        )
        if override_base_prefix:
            # More hoops to get desired result from OLL compared to other sources
            most_recent_export_date = "/".join(
                [s3_prefix, most_recent_export_file.key.lstrip(s3_prefix).split("/")[0]]
            )
        else:
            most_recent_export_date = most_recent_export_file.key.split("/")[0]
        log.info("Most recent export date is %s", most_recent_export_date)
        return [
            obj.key
            for obj in bucket.objects.filter(Prefix=most_recent_export_date)
            if re.search(course_tar_regex, obj.key)
        ]
    except (StopIteration, IndexError):
        log.warning(
            "No %s exported courses found in S3 bucket %s", etl_source, bucket.name
        )
        return []


def _key_matches_run(key: str, run_id: str, s3_prefix: str, etl_source: str) -> bool:
    """
    Check if an S3 key matches a run_id based on etl_source rules.

    Args:
        key: S3 object key
        run_id: The course run ID to match against
        s3_prefix: The S3 prefix used in the key path
        etl_source: The ETL source (mit_edx, oll, etc.)

    Returns:
        bool: True if the key matches the run_id
    """
    matches = re.search(rf"{s3_prefix}/(.+)\.tar\.gz$", key)
    if not matches:
        return False
    key_run_id = matches.group(1).split("/")[-1]

    if etl_source == ETLSource.mit_edx.name:
        # Additional processing of run ids and tarfile names,
        # because edx data is structured differently
        key_run_id = key_run_id.removesuffix("-course-prod-analytics.xml")
        potential_run_ids = rf"{key_run_id.replace('-', '.').replace('+', '.')}"
        return bool(re.search(potential_run_ids, run_id, re.IGNORECASE))
    elif etl_source == ETLSource.oll.name:
        # Additional processing of run ids and tarfile names,
        # because oll data is structured differently
        normalized_key_run_id = (
            key_run_id.replace("_OLL", "")
            .replace("-", ".")
            .replace("_", ".")
            .replace("+", ".")
        )
        normalized_run_id = run_id.replace("-", ".").replace("_", ".").replace("+", ".")
        return bool(re.search(normalized_run_id, normalized_key_run_id, re.IGNORECASE))
    else:
        return key_run_id == run_id


def _find_matching_key_for_course(
    course: LearningResource, keys: list[str], s3_prefix: str, etl_source: str
) -> tuple[str, object] | tuple[None, None]:
    """
    Find the best matching S3 key for a course's runs.

    First tries to match the best run, then falls back to any published run.

    Args:
        course: The LearningResource course object
        keys: List of S3 archive keys to search through
        s3_prefix: The S3 prefix used in the key path
        etl_source: The ETL source (mit_edx, oll, etc.)

    Returns:
        tuple: (matching_key, selected_run) or (None, None) if no match found
    """
    best_run = course.best_run
    course_id = course.id

    # Try to find key for best run first
    if best_run:
        for key in keys:
            if _key_matches_run(key, best_run.run_id, s3_prefix, etl_source):
                log.info(
                    "Found key %s for best run %s of course %s",
                    key,
                    best_run.run_id,
                    course_id,
                )
                return key, best_run

    # If no key found for best run, try any published run (sorted reverse by key)
    runs = course.runs.filter(Q(published=True) | Q(learning_resource__test_mode=True))

    if runs.count() == 0:
        log.warning("No published runs found for course %s", course_id)
        return None, None

    run_keys = [
        (key, run)
        for run in runs
        for key in keys
        if _key_matches_run(key, run.run_id, s3_prefix, etl_source)
    ]

    if run_keys:
        # Sort by key in reverse order and take first
        run_keys.sort(key=lambda x: x[0], reverse=True)
        matching_key, selected_run = run_keys[0]
        log.warning(
            "No key found for best run %s, using key %s for run %s of course %s",
            best_run.run_id if best_run else "None",
            matching_key,
            selected_run.run_id,
            course_id,
        )
        return matching_key, selected_run

    log.error("No matching S3 key found for course %s", course_id)
    return None, None


def _process_course_archive(
    bucket, matching_key: str, selected_run, *, overwrite: bool = False
) -> bool:
    """
    Download and process a course archive file.

    Args:
        bucket: S3 bucket object
        matching_key: S3 key for the archive file
        selected_run: The course run to associate content with
        overwrite: Whether to overwrite existing content

    Returns:
        bool: True if processing succeeded, False otherwise
    """
    with TemporaryDirectory() as export_tempdir:
        course_tarpath = Path(export_tempdir, matching_key.split("/")[-1])
        log.info("course tarpath for run %s is %s", selected_run.run_id, course_tarpath)
        bucket.download_file(matching_key, course_tarpath)
        try:
            checksum = calc_checksum(course_tarpath)
        except ReadError:
            log.exception("Error reading tar file %s, skipping", course_tarpath)
            return False
        if selected_run.checksum == checksum and not overwrite:
            log.info("Checksums match for %s, skipping load", matching_key)
            return True
        try:
            load_content_files(
                selected_run,
                transform_content_files(
                    course_tarpath, selected_run, overwrite=overwrite
                ),
            )
            selected_run.checksum = checksum
            selected_run.save()
        except:  # noqa: E722
            log.exception("Error ingesting OLX content data for %s", matching_key)
            return False
    return True


def sync_edx_course_files(
    etl_source: str,
    ids: list[int],
    keys: list[str],
    *,
    s3_prefix: str | None = None,
    overwrite: bool = False,
):
    """
    Sync all edx course run files for a list of course ids to database

    Args:
        etl_source(str): The edx ETL source
        ids(list of int): list of course ids to process
        keys(list[str]): list of S3 archive keys to search through
        s3_prefix(str): path prefix to include in regex for S3
        overwrite(bool): Whether to overwrite existing content files
    """
    bucket = get_learning_course_bucket(etl_source)
    if s3_prefix is None:
        s3_prefix = "courses"

    for course_id in ids:
        course = LearningResource.objects.get(id=course_id)
        matching_key, selected_run = _find_matching_key_for_course(
            course, keys, s3_prefix, etl_source
        )

        if not matching_key or not selected_run:
            continue

        _process_course_archive(bucket, matching_key, selected_run, overwrite=overwrite)
