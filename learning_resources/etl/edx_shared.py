"""Shared functions for EdX sites"""
import logging
import re
from pathlib import Path
from tempfile import TemporaryDirectory

from learning_resources.etl.constants import ETLSource
from learning_resources.etl.loaders import load_content_files
from learning_resources.etl.utils import (
    calc_checksum,
    get_learning_course_bucket,
    transform_content_files,
)
from learning_resources.models import LearningResourceRun

log = logging.getLogger(__name__)


def get_most_recent_course_archives(
    etl_source: str, s3_prefix: str | None = None
) -> list[str]:
    """
    Retrieve a list of S3 keys for the most recent edx course archives

    Args:
        etl_source(str): The edx ETL source
        s3_prefix(str): The prefix for S3 object keys

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
        course_tar_regex = rf".*/{s3_prefix}/.*\.tar\.gz$"
        most_recent_export_date = next(
            reversed(  # noqa: C413
                sorted(
                    [
                        obj
                        for obj in bucket.objects.filter(Prefix="20")
                        if re.search(course_tar_regex, obj.key)
                    ],
                    key=lambda obj: obj.last_modified,
                )
            )
        ).key.split("/")[0]
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


def sync_edx_course_files(
    etl_source: str, ids: list[int], keys: list[str], s3_prefix: str | None = None
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
        run_id = matches.group(1)
        runs = LearningResourceRun.objects.filter(
            learning_resource__etl_source=etl_source,
            learning_resource_id__in=ids,
            published=True,
        )
        if etl_source == ETLSource.mit_edx.name:
            # Additional processing of run ids and tarfile names,
            # because edx data is a mess of id/file formats
            run_id = run_id.strip(  # noqa: B005
                "-course-prod-analytics.xml"
            )  # suffix on edx tar file basename
            potential_run_ids = rf"{run_id.replace('-', '.').replace('+', '.')}"
            runs = runs.filter(run_id__iregex=potential_run_ids)
        else:
            runs = runs.filter(run_id=run_id)
        run = runs.first()

        if not run:
            continue
        with TemporaryDirectory() as export_tempdir:
            course_tarpath = Path(export_tempdir, key.split("/")[-1])
            bucket.download_file(key, course_tarpath)
            checksum = calc_checksum(course_tarpath)
            if run.checksum == checksum:
                continue
            try:
                load_content_files(run, transform_content_files(course_tarpath, run))
                run.checksum = checksum
                run.save()
            except:  # noqa: E722
                log.exception("Error ingesting OLX content data for %s", key)
