"""Shared functions for EdX sites"""

import logging
import re
from pathlib import Path
from tarfile import ReadError
from tempfile import TemporaryDirectory

from django.conf import settings
from django.db.models import Q

from learning_resources.etl.constants import ETLSource
from learning_resources.etl.loaders import load_content_files
from learning_resources.etl.utils import (
    calc_checksum,
    get_bucket_by_name,
    get_learning_course_bucket,
    transform_content_files,
)
from learning_resources.models import LearningResourceRun

log = logging.getLogger(__name__)

EDX_S3_BASE_PREFIX = "20"


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
                        (obj.key, obj.last_modified)
                        for obj in bucket.objects.filter(
                            # Use s3_prefix for OLL, "20" for all others
                            Prefix=s3_prefix
                            if override_base_prefix
                            else EDX_S3_BASE_PREFIX
                        )
                        if re.search(course_tar_regex, obj.key)
                    ],
                    key=lambda obj: obj[1],
                )
            )
        )
        if override_base_prefix:
            # More hoops to get desired result from OLL compared to other sources
            most_recent_export_date = "/".join(
                [s3_prefix, most_recent_export_file[0].lstrip(s3_prefix).split("/")[0]]
            )
        else:
            most_recent_export_date = most_recent_export_file[0].split("/")[0]
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
    bucket = get_bucket_by_name(settings.COURSE_ARCHIVE_BUCKET_NAME)
    with TemporaryDirectory() as export_tempdir:
        archive_filename = s3_key.split("/")[-1]
        archive_path = Path(export_tempdir, archive_filename)
        bucket.download_file(s3_key, archive_path)
        run = run_for_edx_archive(etl_source, s3_key, course_id=course_id)
        if not run:
            err = f"No {etl_source} run found for archive {s3_key}"
            raise ValueError(err)
        course = run.learning_resource
        if course.published and not course.test_mode and course.best_run != run:
            # This is not the best run for the published course, so skip it
            log.warning(
                "%s not the best run for %s, skipping", run.run_id, course.readable_id
            )
            return
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
    potential_run_id = Path(archive_filename).parent.name.split("/")[-1]
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
    if etl_source == ETLSource.mit_edx.name:
        # Additional processing of run ids and tarfile names,
        # because edx data is structured differently
        run_id = potential_run_id.strip(  # noqa: B005
            "-course-prod-analytics.xml"
        )  # suffix on edx tar file basename
        potential_run_ids = rf"{run_id.replace('-', '.').replace('+', '.')}"
        runs = runs.filter(run_id__iregex=potential_run_ids)
    elif etl_source == ETLSource.oll.name:
        # Additional processing of run ids and tarfile names,
        # because oll data is structured differently
        filename_only = archive_filename.split("/")[-1]
        potential_run_id = filename_only.split(".tar.gz")[0]
        run_id = (
            rf"{potential_run_id.replace('_OLL', '')}".replace("-", ".")
            .replace("_", ".")
            .replace("+", ".")
        )
        runs = runs.filter(run_id__iregex=run_id)
    else:
        runs = runs.filter(run_id=potential_run_id)
    # There should be only 1 matching run per course archive, warn if not
    if runs.count() > 1:
        log.warning("There are %d runs for %s", runs.count(), run_id)
    return runs.first()


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
    """
    bucket = get_learning_course_bucket(etl_source)
    if s3_prefix is None:
        s3_prefix = "courses"
    for key in keys:
        matches = re.search(rf"{s3_prefix}/(.+)\.tar\.gz$", key)
        run_id = matches.group(1).split("/")[-1]
        log.info("Run is %s", run_id)
        runs = (
            LearningResourceRun.objects.filter(
                learning_resource__etl_source=etl_source,
                learning_resource_id__in=ids,
            )
            .filter(Q(published=True) | Q(learning_resource__test_mode=True))
            .filter(
                Q(learning_resource__published=True)
                | Q(learning_resource__test_mode=True)
            )
        )

        if etl_source == ETLSource.mit_edx.name:
            # Additional processing of run ids and tarfile names,
            # because edx data is structured differently
            run_id = run_id.strip(  # noqa: B005
                "-course-prod-analytics.xml"
            )  # suffix on edx tar file basename
            potential_run_ids = rf"{run_id.replace('-', '.').replace('+', '.')}"
            runs = runs.filter(run_id__iregex=potential_run_ids)
        elif etl_source == ETLSource.oll.name:
            # Additional processing of run ids and tarfile names,
            # because oll data is structured differently
            run_id = (
                rf"{run_id.replace('_OLL', '')}".replace("-", ".")
                .replace("_", ".")
                .replace("+", ".")
            )
            runs = runs.filter(run_id__iregex=run_id)
        else:
            runs = runs.filter(run_id=run_id)

        # There should be only 1 matching run per course archive, warn if not
        if runs.count() > 1:
            log.warning("There are %d runs for %s", runs.count(), run_id)

        if not runs:
            log.info("No runs found for %s, skipping", run_id)
            continue

        run = runs.first()
        course = run.learning_resource
        if course.published and not course.test_mode and course.best_run != run:
            # This is not the best run for the published course, so skip it
            log.info("Not the best run for %s, skipping", run_id)
            continue

        process_course_archive(bucket, key, run, overwrite=overwrite)
