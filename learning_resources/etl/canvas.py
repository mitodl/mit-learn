import base64
import json
import logging
import sys
import zipfile
from collections import defaultdict
from collections.abc import Generator
from datetime import datetime
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.parse import unquote_plus

import pypdfium2 as pdfium
from defusedxml import ElementTree
from django.conf import settings
from litellm import completion
from PIL import Image

from learning_resources.constants import (
    VALID_TUTOR_PROBLEM_TYPES,
    LearningResourceType,
    PlatformType,
)
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
from main.utils import now_in_utc

log = logging.getLogger(__name__)


def sync_canvas_archive(bucket, key: str, overwrite):
    """
    Sync a Canvas course archive from S3
    """
    from learning_resources.etl.loaders import load_content_files, load_problem_files

    course_folder = key.lstrip(settings.CANVAS_COURSE_BUCKET_PREFIX).split("/")[0]
    url_config_file = f"{key.split('.imscc')[0]}.metadata.json"
    with TemporaryDirectory() as export_tempdir:
        course_archive_path = Path(export_tempdir, key.split("/")[-1])
        bucket.download_file(key, course_archive_path)
        url_config = _get_url_config(bucket, export_tempdir, url_config_file)
        resource_readable_id, run = run_for_canvas_archive(
            course_archive_path, course_folder=course_folder, overwrite=overwrite
        )
        checksum = calc_checksum(course_archive_path)
        if run:
            canvas_content_files = list(
                transform_canvas_content_files(
                    course_archive_path, run, url_config=url_config, overwrite=overwrite
                )
            )
            load_content_files(
                run,
                canvas_content_files,
            )

            load_problem_files(
                run,
                transform_canvas_problem_files(
                    course_archive_path, run, overwrite=overwrite
                ),
            )
            run.checksum = checksum
            run.save()

    return resource_readable_id


def _get_url_config(bucket, export_tempdir: str, url_config_file: str) -> dict:
    """
    Get URL (citation) config from the metadata JSON file
    """
    url_config_path = Path(export_tempdir, url_config_file.split("/")[-1])
    # download the url config file
    bucket.download_file(url_config_file, url_config_path)
    url_config = {}
    with Path.open(url_config_path, "rb") as f:
        for url_item in json.loads(f.read().decode("utf-8")).get("course_files", []):
            url_key = url_item["file_path"]
            url_key = unquote_plus(url_key.lstrip(url_key.split("/")[0]))
            url_config[url_key] = url_item["url"]
    return url_config


def _course_url(course_archive_path) -> str:
    context_info = parse_context_xml(course_archive_path)
    return f"https://{context_info.get('canvas_domain')}/courses/{context_info.get('course_id')}/"


def run_for_canvas_archive(course_archive_path, course_folder, overwrite):
    """
    Generate and return a LearningResourceRun for a Canvas course
    """
    checksum = calc_checksum(course_archive_path)
    course_info = parse_canvas_settings(course_archive_path)
    course_title = course_info.get("title")
    url = _course_url(course_archive_path)
    start_at = course_info.get("start_at")
    end_at = course_info.get("conclude_at")
    if start_at:
        try:
            start_at = datetime.fromisoformat(start_at)
        except (ValueError, TypeError):
            log.warning("Invalid start_at date format: %s", start_at)
    if end_at:
        try:
            end_at = datetime.fromisoformat(end_at)
        except (ValueError, TypeError):
            log.warning("Invalid end_at date format: %s", end_at)

    readable_id = f"{course_folder}-{course_info.get('course_code')}"
    # create placeholder learning resource
    resource, _ = LearningResource.objects.update_or_create(
        readable_id=readable_id,
        defaults={
            "title": course_title,
            "published": False,
            "url": url,
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
            start_date=start_at,
            end_date=end_at,
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
    course_zipfile: Path, run: LearningResourceRun, url_config: dict, *, overwrite
) -> Generator[dict, None, None]:
    """
    Transform published content files from a Canvas course zipfile
    """
    basedir = course_zipfile.name.split(".")[0]
    zipfile_path = course_zipfile.absolute()
    # grab published module and file items
    published_items = [
        Path(item["path"]).resolve()
        for item in parse_module_meta(zipfile_path)["active"]
    ] + [
        Path(item["path"]).resolve()
        for item in parse_files_meta(zipfile_path)["active"]
    ]

    def _generate_content():
        """Inner generator for yielding content data"""
        with (
            TemporaryDirectory(prefix=basedir) as olx_path,
            zipfile.ZipFile(zipfile_path, "r") as course_archive,
        ):
            for member in course_archive.infolist():
                if Path(member.filename).resolve() in published_items:
                    course_archive.extract(member, path=olx_path)
                    log.debug("processing active file %s", member.filename)
                else:
                    log.debug("skipping unpublished file %s", member.filename)

            for content_data in _process_olx_path(olx_path, run, overwrite=overwrite):
                url_path = content_data["source_path"].lstrip(
                    content_data["source_path"].split("/")[0]
                )
                content_url = url_config.get(url_path, "")
                if content_url:
                    content_data["url"] = content_url
                yield content_data

    # use subgenerator for yielding content data
    published_keys = []
    for content_data in _generate_content():
        full_path = Path(basedir) / Path(content_data["source_path"])
        published_keys.append(get_edx_module_id(str(full_path), run))
        yield content_data
    unpublished_content = run.content_files.exclude(key__in=published_keys)
    # remove unpublished contentfiles
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
            path_parts = path.split("/", 1)
            problem_file_data["problem_title"] = path_parts[0]
            for problem_type in VALID_TUTOR_PROBLEM_TYPES:
                if problem_type in path_parts[1].lower():
                    problem_file_data["type"] = problem_type
                    break
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


def parse_context_xml(course_archive_path: str) -> dict:
    with zipfile.ZipFile(course_archive_path, "r") as course_archive:
        context = course_archive.read("course_settings/context.xml")
    root = ElementTree.fromstring(context)
    namespaces = {"ns": "http://canvas.instructure.com/xsd/cccv1p0"}
    context_info = {}
    item_keys = ["course_id", "root_account_id", "canvas_domain", "root_account_name"]
    for key in item_keys:
        element = root.find(f"ns:{key}", namespaces)
        if element is not None:
            context_info[key] = element.text

    return context_info


def is_file_published(file_meta: dict) -> bool:
    """
    Determine if a Canvas file (from files_meta.xml) is published/visible to students.

    Args:
        file_meta (dict): Parsed metadata for a file.
    Returns:
        bool: True if file is published/visible, False otherwise.
    """
    now = now_in_utc()

    hidden = str(file_meta.get("hidden", "false")).lower() == "true"
    locked = str(file_meta.get("locked", "false")).lower() == "true"

    unlock_at = file_meta.get("unlock_at")
    lock_at = file_meta.get("lock_at")

    visibility = file_meta.get("visibility", "inherit")

    # If explicitly hidden or locked → unpublished
    if hidden or locked:
        return False

    if unlock_at and unlock_at.lower() != "nil":
        try:
            unlock_dt = datetime.fromisoformat(unlock_at.replace("Z", "+00:00"))
            if now < unlock_dt:
                return False
        except Exception:
            log.exception("Error parsing date: %s", unlock_at)

    if lock_at and lock_at.lower() != "nil":
        try:
            lock_dt = datetime.fromisoformat(lock_at.replace("Z", "+00:00"))
            if now > lock_dt:
                return False
        except Exception:
            log.exception("Error parsing date: %s", lock_at)
    # Visibility rules
    if visibility in ("course", "inherit"):
        return True
    elif visibility in ("institution", "public"):
        return True  # technically more visible
    return False


def parse_files_meta(course_archive_path: str) -> dict:
    """
    Parse course_settings/files_meta.xml and return publish/active status of resources.
    """
    publish_status = {"active": [], "unpublished": []}
    with zipfile.ZipFile(course_archive_path, "r") as course_archive:
        files_meta_path = "course_settings/files_meta.xml"
        if files_meta_path not in course_archive.namelist():
            return publish_status
        files_xml = course_archive.read(files_meta_path)
        manifest_xml = course_archive.read("imsmanifest.xml")
    resource_map = extract_resources_by_identifier(manifest_xml)

    root = ElementTree.fromstring(files_xml)
    namespaces = {"c": "http://canvas.instructure.com/xsd/cccv1p0"}
    try:
        for file_elem in root.findall(".//c:file", namespaces):
            meta = dict(file_elem.attrib)
            for child in file_elem:
                tag = child.tag
                # strip namespace
                if "}" in tag:
                    tag = tag.split("}", 1)[1]
                if child.attrib.get("nil") == "true":
                    value = None
                else:
                    value = (child.text or "").strip()
                meta[tag] = value
            item_info = resource_map.get(meta.get("identifier"), {})
            meta["published"] = is_file_published(meta)
            for file in item_info.get("files", []):
                file_data = meta.copy()
                file_path = Path(file)
                file_data["path"] = file_path
                file_data["title"] = file_data.get("display_name")
                if file_data["published"]:
                    publish_status["active"].append(file_data)
                else:
                    publish_status["unpublished"].append(file_data)
    except Exception:
        log.exception("Error parsing XML: %s", sys.stderr)
        return None
    return publish_status


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
    Extract resources from an IMS manifest file and
    return a map keyed by identifierref.
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


def extract_resources_by_identifier(manifest_xml: str) -> dict:
    """
    Extract resources from an IMS manifest
    file and return a map keyed by identifier.
    """
    root = ElementTree.fromstring(manifest_xml)

    namespaces = {
        "imscp": "http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1",
        "lom": "http://ltsc.ieee.org/xsd/imsccv1p1/LOM/resource",
        "lomimscc": "http://ltsc.ieee.org/xsd/imsccv1p1/LOM/manifest",
    }

    resources_dict = {}

    # Find all resource elements
    for resource in root.findall(".//imscp:resource[@identifier]", namespaces):
        identifier = resource.get("identifier")
        resource_type = resource.get("type")
        href = resource.get("href")

        # Get all file elements within the resource
        files = [
            file_elem.get("href")
            for file_elem in resource.findall("imscp:file", namespaces)
        ]

        # Extract metadata if present
        metadata = {}
        metadata_elem = resource.find("imscp:metadata", namespaces)
        if metadata_elem is not None:
            # You can expand this to extract specific metadata fields as needed
            metadata["has_metadata"] = True

        resources_dict[identifier] = {
            "identifier": identifier,
            "type": resource_type,
            "href": href,
            "files": files,
            "metadata": metadata,
        }

    return resources_dict


def pdf_to_base64_images(pdf_path, fmt="JPEG", max_size=2000, quality=85):
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

    pdf = pdfium.PdfDocument(pdf_path)
    for page_index in range(len(pdf)):
        page = pdf.get_page(page_index)
        image = page.render(scale=2).to_pil()
        page.close()
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
        yield img_str
    pdf.close()


def _pdf_to_markdown(pdf_path):
    markdown = ""
    for im in pdf_to_base64_images(pdf_path):
        response = completion(
            api_base=settings.LITELLM_API_BASE,
            custom_llm_provider=settings.LITELLM_CUSTOM_PROVIDER,
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
