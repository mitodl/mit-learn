import base64
import logging
import zipfile
from collections.abc import Generator
from datetime import datetime
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory

import pypdfium2 as pdfium
from django.conf import settings
from litellm import completion
from PIL import Image

from learning_resources.constants import (
    TUTOR_PROBLEM_TYPE,
    TUTOR_SOLUTION_TYPE,
    LearningResourceType,
    PlatformType,
)
from learning_resources.etl.canvas_utils import (
    canvas_course_url,
    canvas_url_config,
    get_published_items,
    parse_canvas_settings,
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
        url_config = canvas_url_config(bucket, export_tempdir, url_config_file)
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


def run_for_canvas_archive(course_archive_path, course_folder, overwrite):
    """
    Generate and return a LearningResourceRun for a Canvas course
    """
    checksum = calc_checksum(course_archive_path)
    course_info = parse_canvas_settings(course_archive_path)
    course_title = course_info.get("title")
    url = canvas_course_url(course_archive_path)
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


def transform_canvas_content_files(
    course_zipfile: Path, run: LearningResourceRun, url_config: dict, *, overwrite
) -> Generator[dict, None, None]:
    """
    Transform published content files from a Canvas course zipfile
    """
    basedir = course_zipfile.name.split(".")[0]
    zipfile_path = course_zipfile.absolute()
    published_items = get_published_items(zipfile_path, url_config)

    def _generate_content():
        """Inner generator for yielding content data"""
        with (
            TemporaryDirectory(prefix=basedir) as olx_path,
            zipfile.ZipFile(zipfile_path, "r") as course_archive,
        ):
            for member in course_archive.infolist():
                member_path = Path(member.filename).resolve()
                if member_path in published_items:
                    course_archive.extract(member, path=olx_path)
                    log.debug("processing active file %s", member.filename)
                else:
                    log.debug("skipping unpublished file %s", member.filename)

            for content_data in _process_olx_path(olx_path, run, overwrite=overwrite):
                url_path = content_data["source_path"].lstrip(
                    content_data["source_path"].split("/")[0]
                )
                item_meta = published_items.get(
                    Path(content_data["source_path"]).resolve(), {}
                )
                item_url_config = url_config.get(url_path, {}) or url_config.get(
                    item_meta.get("title"), {}
                )
                content_url = item_url_config.get("url")
                content_data["content_title"] = item_meta.get("title")
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

            if len(path_parts) != 2:  # noqa: PLR2004
                log.warning(
                    "unnested file in problem folder for course run %s: %s",
                    run.id,
                    path,
                )
                continue

            problem_file_data["problem_title"] = path_parts[0]

            problem_file_data["file_name"] = path_parts[1]

            if TUTOR_SOLUTION_TYPE in problem_file_data["file_name"].lower():
                problem_file_data["type"] = TUTOR_SOLUTION_TYPE
            else:
                problem_file_data["type"] = TUTOR_PROBLEM_TYPE

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
    """
    Convert a PDF file to markdown using an llm
    """
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
