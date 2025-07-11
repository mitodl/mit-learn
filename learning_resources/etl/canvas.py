import logging
import zipfile
from collections.abc import Generator
from pathlib import Path
from tempfile import TemporaryDirectory

from defusedxml import ElementTree
from django.conf import settings

from learning_resources.constants import LearningResourceType
from learning_resources.etl.constants import ETLSource
from learning_resources.etl.utils import _process_olx_path, calc_checksum
from learning_resources.models import LearningResource, LearningResourceRun

log = logging.getLogger(__name__)


def sync_canvas_archive(bucket, key: str, overwrite):
    """
    Sync a Canvas course archive from S3
    """
    from learning_resources.etl.loaders import load_content_files

    course_folder = key.lstrip(settings.CANVAS_COURSE_BUCKET_PREFIX).split("/")[0]

    with TemporaryDirectory() as export_tempdir:
        course_archive_path = Path(export_tempdir, key.split("/")[-1])
        bucket.download_file(key, course_archive_path)
        resource_readable_id, run = run_for_canvas_archive(
            course_archive_path, course_folder=course_folder, overwrite=overwrite
        )
        checksum = calc_checksum(course_archive_path)
        if run:
            load_content_files(
                run,
                transform_canvas_content_files(
                    course_archive_path, run, overwrite=overwrite
                ),
            )
            run.checksum = checksum
            run.save()
    return resource_readable_id, run


def run_for_canvas_archive(course_archive_path, course_folder, overwrite):
    """
    Generate and return a LearningResourceRun for a Canvas course
    """
    checksum = calc_checksum(course_archive_path)
    course_info = parse_canvas_settings(course_archive_path)
    course_title = course_info.get("title")
    readable_id = f"{course_folder}-{course_info.get('course_code')}"
    # create placeholder learning resource
    resource, _ = LearningResource.objects.get_or_create(
        readable_id=readable_id,
        defaults={
            "title": course_title,
            "published": False,
            "test_mode": True,
            "etl_source": ETLSource.canvas.name,
            "resource_type": LearningResourceType.course.name,
        },
    )
    if resource.runs.count() == 0:
        LearningResourceRun.objects.create(
            run_id=f"{readable_id}+canvas",
            learning_resource=resource,
            published=True,
        )
    run = resource.runs.first()
    resource_readable_id = run.learning_resource.readable_id
    if run.checksum == checksum and not overwrite:
        log.info("Checksums match for %s, skipping load", readable_id)
        return resource_readable_id, None
    run.checksum = checksum
    run.save()
    return resource_readable_id, run


def parse_canvas_settings(course_archive_path):
    """
    Get course attributes from a Canvas course archive
    """
    with zipfile.ZipFile(course_archive_path, "r") as course_archive:
        xml_string = course_archive.read("course_settings/course_settings.xml")
    tree = ElementTree.fromstring(xml_string)
    attributes = {}
    for node in tree.iter():
        tag = node.tag.split("}")[1] if "}" in node.tag else node.tag
        attributes[tag] = node.text
    return attributes


def transform_canvas_content_files(
    course_zipfile: Path, run: LearningResourceRun, *, overwrite
) -> Generator[dict, None, None]:
    """
    Transform content files from a Canvas course zipfile
    """
    basedir = course_zipfile.name.split(".")[0]
    with (
        TemporaryDirectory(prefix=basedir) as olx_path,
        zipfile.ZipFile(course_zipfile.absolute(), "r") as course_archive,
    ):
        for member in course_archive.infolist():
            course_archive.extract(member, path=olx_path)
        yield from _process_olx_path(olx_path, run, overwrite=overwrite)
