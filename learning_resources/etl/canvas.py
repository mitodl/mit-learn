import base64
import logging
import sys
import zipfile
from collections import defaultdict
from collections.abc import Generator
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory

from defusedxml import ElementTree
from django.conf import settings
from litellm import completion
from pdf2image import convert_from_path
from PIL import Image

from learning_resources.constants import LearningResourceType, PlatformType
from learning_resources.etl.constants import ETLSource
from learning_resources.etl.utils import (
    _process_olx_path,
    calc_checksum,
    get_edx_module_id,
)
from learning_resources.models import (
    LearningResource,
    LearningResourcePlatform,
    LearningResourceRun,
)
from learning_resources.utils import bulk_resources_unpublished_actions
from learning_resources_search.constants import (
    CONTENT_FILE_TYPE,
)

log = logging.getLogger(__name__)


def sync_canvas_archive(bucket, key: str, overwrite):
    """
    Sync a Canvas course archive from S3
    """
    from learning_resources.etl.loaders import load_content_files, load_problem_files

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

            load_problem_files(
                run,
                transform_canvas_problem_files(
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
    resource, _ = LearningResource.objects.update_or_create(
        readable_id=readable_id,
        defaults={
            "title": course_title,
            "published": False,
            "test_mode": True,
            "etl_source": ETLSource.canvas.name,
            "platform": LearningResourcePlatform.objects.get(
                code=PlatformType.canvas.name
            ),
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
        log.debug("Checksums match for %s, skipping load", readable_id)
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
    module_metadata = parse_module_meta(course_zipfile.absolute())
    published_items = [
        Path(item["path"]).resolve() for item in module_metadata["active"]
    ]
    published_keys = []
    with (
        TemporaryDirectory(prefix=basedir) as olx_path,
        zipfile.ZipFile(course_zipfile.absolute(), "r") as course_archive,
    ):
        for member in course_archive.infolist():
            if Path(member.filename).resolve() in published_items:
                full_path = Path(olx_path) / Path(member.filename)
                published_keys.append(get_edx_module_id(str(full_path), run))
                course_archive.extract(member, path=olx_path)
                log.debug("processing active file %s", member.filename)
            else:
                log.debug("skipping unpublished file %s", member.filename)
        yield from _process_olx_path(olx_path, run, overwrite=overwrite)

    unpublished_content = run.content_files.exclude(key__in=published_keys)

    bulk_resources_unpublished_actions(
        list(unpublished_content.values_list("id", flat=True)), CONTENT_FILE_TYPE
    )
    unpublished_content.delete()


def transform_canvas_problem_files(
    course_zipfile: Path, run: LearningResourceRun, *, overwrite
) -> Generator[dict, None, None]:
    """
    Transform problem files from a Canvas course zipfile
    """
    basedir = course_zipfile.name.split(".")[0]
    with (
        TemporaryDirectory(prefix=basedir) as olx_path,
        zipfile.ZipFile(course_zipfile.absolute(), "r") as course_archive,
    ):
        for member in course_archive.infolist():
            if member.filename.startswith(settings.CANVAS_TUTORBOT_FOLDER):
                course_archive.extract(member, path=olx_path)
                log.debug("processing active problem set file %s", member.filename)
        for file_data in _process_olx_path(olx_path, run, overwrite=overwrite):
            keys_to_keep = [
                "run",
                "content",
                "archive_checksum",
                "source_path",
                "file_extension",
            ]
            problem_file_data = {
                key: file_data[key] for key in keys_to_keep if key in file_data
            }

            path = file_data["source_path"]
            path = path[len(settings.CANVAS_TUTORBOT_FOLDER) :]
            path_parts = path.split("/")
            problem_file_data["problem_title"] = path_parts[0]

            if path_parts[1] in ["problem", "solution"]:
                problem_file_data["type"] = path_parts[1]
            if (
                problem_file_data["file_extension"].lower() == ".pdf"
                and settings.CANVAS_PDF_TRANSCRIPTION_MODEL
            ):
                markdown_content = _pdf_to_markdown(
                    Path(olx_path) / Path(problem_file_data["source_path"])
                )
                if markdown_content:
                    problem_file_data["content"] = markdown_content
            yield problem_file_data


def parse_module_meta(course_archive_path: str) -> dict:
    """
    Parse module_meta.xml and return publish/active status of resources.
    """
    with zipfile.ZipFile(course_archive_path, "r") as course_archive:
        module_xml = course_archive.read("course_settings/module_meta.xml")
        manifest_xml = course_archive.read("imsmanifest.xml")
    resource_map = extract_resources_by_identifierref(manifest_xml)
    publish_status = {"active": [], "unpublished": []}
    try:
        namespaces = {"ns": "http://canvas.instructure.com/xsd/cccv1p0"}
        root = ElementTree.fromstring(module_xml)
        for module in root.findall(".//ns:module", namespaces):
            module_title = module.find("ns:title", namespaces).text
            for item in module.findall("ns:items/ns:item", namespaces):
                item_state = item.find("ns:workflow_state", namespaces).text
                item_title = item.find("ns:title", namespaces).text
                identifierref = (
                    item.find("ns:identifierref", namespaces).text
                    if item.find("ns:identifierref", namespaces) is not None
                    else None
                )
                content_type = item.find("ns:content_type", namespaces).text
                items = resource_map.get(identifierref, {})
                for item_info in items:
                    for file in item_info.get("files", []):
                        file_path = Path(file)
                        status = "active" if item_state == "active" else "unpublished"
                        publish_status[status].append(
                            {
                                "title": item_title,
                                "type": content_type,
                                "path": file_path,
                                "module": module_title,
                            }
                        )
    except Exception:
        log.exception("Error parsing XML: %s", sys.stderr)
        return None
    return publish_status


def extract_resources_by_identifierref(manifest_xml: str) -> dict:
    """
    Extract resources from an IMS manifest file and return a map keyed by identifierref.
    """
    root = ElementTree.fromstring(manifest_xml)

    namespaces = {
        "imscp": "http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1",
        "lom": "http://ltsc.ieee.org/xsd/imsccv1p1/LOM/resource",
        "lomimscc": "http://ltsc.ieee.org/xsd/imsccv1p1/LOM/manifest",
    }
    # Dictionary to hold resources keyed by identifierref
    resources_dict = defaultdict(list)
    # Find all item elements with identifierref attributes
    for item in root.findall(".//imscp:item[@identifierref]", namespaces):
        identifierref = item.get("identifierref")
        title = (
            item.find("imscp:title", namespaces).text
            if item.find("imscp:title", namespaces) is not None
            else "No Title"
        )
        resource = root.find(
            f'.//imscp:resource[@identifier="{identifierref}"]', namespaces
        )
        if resource is not None:
            # Get all file elements within the resource
            files = [
                file_elem.get("href")
                for file_elem in resource.findall("imscp:file", namespaces)
            ]

            resources_dict[identifierref].append(
                {"title": title, "files": files, "type": resource.get("type")}
            )
    return dict(resources_dict)


def pdf_to_base64_images(pdf_path, dpi=200, fmt="JPEG", max_size=2000, quality=85):
    """
    Convert a PDF file to a list of base64 encoded images (one per page).
    Resizes images to reduce file size while keeping good OCR quality.

    Args:
        pdf_path (str): Path to the PDF file
        dpi (int): DPI for the output images (default: 200)
        fmt (str): Output format ('JPEG' or 'PNG') (default: 'JPEG')
        max_size (int): Maximum width/height in pixels (default: 2000)
        quality (int): JPEG quality (1-100, default: 85)

    Returns:
        list: List of base64 encoded strings (one per page)
    """
    images = convert_from_path(pdf_path, dpi=dpi)
    base64_images = []

    for image in images:
        # Resize the image if it's too large (preserving aspect ratio)
        if max(image.size) > max_size:
            image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

        buffered = BytesIO()

        # Save with optimized settings
        if fmt.upper() == "JPEG":
            image.save(buffered, format="JPEG", quality=quality, optimize=True)
        else:  # PNG
            image.save(buffered, format="PNG", optimize=True)

        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        base64_images.append(img_str)

    return base64_images


def _pdf_to_markdown(pdf_path):
    markdown = ""
    for im in pdf_to_base64_images(pdf_path):
        response = completion(
            model=settings.CANVAS_PDF_TRANSCRIPTION_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": settings.CANVAS_TRANSCRIPTION_PROMPT,
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{im}",
                            },
                        },
                    ],
                }
            ],
        )
        markdown_snippet = (
            response.json()["choices"][0]["message"]["content"]
            .removeprefix("```markdown\n")
            .removesuffix("\n```")
        )

        markdown += markdown_snippet
    return markdown
