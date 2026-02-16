"""Helper functions for ETL"""

import base64
import glob
import json
import logging
import math
import mimetypes
import os
import re
import tarfile
import uuid
import zipfile
from collections import Counter
from collections.abc import Generator
from datetime import UTC, datetime
from decimal import Decimal
from hashlib import md5
from io import BytesIO
from pathlib import Path
from subprocess import check_call
from tempfile import TemporaryDirectory

import boto3
import pypdfium2 as pdfium
import rapidjson
import requests
from defusedxml import ElementTree
from django.conf import settings
from django.utils.dateparse import parse_duration
from django.utils.text import slugify
from PIL import Image
from pycountry import currencies
from pypdf import PdfReader
from pypdf.errors import FileNotDecryptedError
from tika import parser as tika_parser

from learning_resources.constants import (
    CONTENT_TYPE_FILE,
    CONTENT_TYPE_PDF,
    CONTENT_TYPE_VIDEO,
    CURRENCY_USD,
    DEPARTMENTS,
    VALID_TEXT_FILE_TYPES,
    LearningResourceDelivery,
    LevelType,
    OfferedBy,
    RunStatus,
)
from learning_resources.converters.opendataloader_llm_converter import (
    OpenDataLoaderLLMConverter,
)
from learning_resources.etl.constants import (
    RESOURCE_DELIVERY_MAPPING,
    TIME_INTERVAL_MAPPING,
    CommitmentConfig,
    CourseNumberType,
    DurationConfig,
    ETLSource,
)
from learning_resources.models import (
    ContentFile,
    Course,
    LearningResource,
    LearningResourceRun,
    LearningResourceTopic,
    LearningResourceTopicMapping,
    TutorProblemFile,
)

log = logging.getLogger(__name__)


def load_offeror_topic_map(offeror_code: str):
    """
    Load the topic mappings from the database.

    Returns:
    - dict, the mapping dictionary
    """

    pmt_mappings = (
        LearningResourceTopicMapping.objects.filter(offeror__code=offeror_code)
        .prefetch_related("topic")
        .all()
    )

    mappings = {}

    for pmt_mapping in pmt_mappings:
        if pmt_mapping.topic_name not in mappings:
            mappings[pmt_mapping.topic_name] = []

        mappings[pmt_mapping.topic_name].append(pmt_mapping.topic.name)

    return mappings


def transform_topics(topics: list, offeror_code: str):
    """
    Transform topics by using the data from LearningResourceTopics and the
    persisted mappings.

    Args:
        topics (list of dict):
            the topics to transform

    Return:
        list of dict: the transformed topics
    """
    topic_mappings = load_offeror_topic_map(offeror_code)

    transformed_topics = []

    for topic in topics:
        if topic["name"] in topic_mappings:
            [
                transformed_topics.append({"name": mapped_topic})
                for mapped_topic in topic_mappings.get(topic["name"])
            ]
        else:
            base_topic = LearningResourceTopic.objects.filter(
                name=topic["name"]
            ).exists()

            transformed_topics.append({"name": topic["name"]}) if base_topic else None

    return transformed_topics


def without_none(values) -> list:
    """Remove all occurrences of None from a list."""
    return [x for x in values if x is not None]


def transform_levels(level_labels: list[str]) -> list[LevelType]:
    """
    Given list of level labels, return list of keys.

    ["high_school", "undergraduate"]
    """
    return [
        LevelType(label).name for label in level_labels if label in LevelType.values()
    ]


def _infinite_counter():
    """Infinite counter"""
    count = 0
    while True:
        yield count
        count += 1


def sync_s3_text(bucket, key, content_meta):
    """
    Save the extracted text for a ContentFile to S3 for future use

    Args:
        bucket(s3.Bucket): the bucket to place data in
        key(str): the original key of the content file
        content_meta(dict): the content metadata returned by tika
    """
    if bucket and content_meta:
        bucket.put_object(
            Key=f"extracts/{key}.json",
            Body=rapidjson.dumps(content_meta),
            ACL="public-read",
        )


def extract_text_metadata(data, *, other_headers=None):
    """
    Use tika to extract text content from file data

    Args:
        data (str): File contents
        other_headers (dict): Optional other headers to send to tika

    Returns:
         dict: metadata returned by tika, including content

    """
    if not data:
        return None

    headers = {**other_headers} if other_headers else {}
    if settings.TIKA_OCR_STRATEGY:
        headers["X-Tika-PDFOcrStrategy"] = settings.TIKA_OCR_STRATEGY
    if settings.TIKA_ACCESS_TOKEN:
        headers["X-Access-Token"] = settings.TIKA_ACCESS_TOKEN

    request_options = {
        "timeout": settings.TIKA_TIMEOUT,
        "verify": True,
        "headers": headers,
    }

    return tika_parser.from_buffer(data, requestOptions=request_options)


def extract_text_from_url(url, *, mime_type=None):
    """
    Retrieve data from a URL and parse it with tika

    Args:
        url(str): The URL to retrieve content from
        mime_type(str): The expected mime-type of the content

    Returns:
        str: The text contained in the URL content.
    """
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    if response.content:
        return extract_text_metadata(
            response.content,
            other_headers={"Content-Type": mime_type} if mime_type else {},
        )
    return None


def generate_readable_id(text):
    """
    Generate a unique id based on a string

    Args:
        text(str): The string to base the id on

    Returns:
        str: The unique id

    """
    return f"{slugify(text)}{uuid.uuid3(uuid.NAMESPACE_URL, text).hex}"


def get_max_contentfile_length(field):
    """
    Get the max length of a ContentFile field

    Args:
        field (str): the name of the field

    Returns:
        int: the max_length of the field
    """
    return ContentFile._meta.get_field(field).max_length  # noqa:SLF001


def strip_extra_whitespace(text):
    """
    Remove extra whitespace from text

    Args:
        text: string to strip extra whitespace from

    Returns:
        str: text without extra whitespace

    """
    return re.sub(r"[\s]{2,}", " ", text).strip()


def parse_dates(date_string, hour=12):
    """
    Extract a pair of dates from a string

    Args:
        date_string(str): A string containing start and end dates
        hour(int): Default hour of the day

    Returns:
        tuple of datetime: Start and end datetimes
    """
    # Start and end dates in same month (Jun 18-19, 2020)
    pattern_1_month = re.compile(
        r"(?P<start_m>\w+)\s+(?P<start_d>\d+)\s*-\s*(?P<end_d>\d+)?,\s*(?P<year>\d{4})$"
    )
    # Start and end dates in different months, same year (Jun 18 - Jul 18, 2020)
    pattern_1_year = re.compile(
        r"(?P<start_m>\w+)\s+(?P<start_d>\d+)\s*\-\s*(?P<end_m>\w+)\s+(?P<end_d>\d+),\s*(?P<year>\d{4})$"
    )
    # Start and end dates in different years (Dec 21, 2020-Jan 10,2021)
    pattern_2_years = re.compile(
        r"(?P<start_m>\w+)\s+(?P<start_d>\d+),\s*(?P<start_y>\d{4})\s*-\s*(?P<end_m>\w+)\s+(?P<end_d>\d+),\s*(?P<end_y>\d{4})$"
    )

    match = re.match(pattern_1_month, date_string)
    if match:
        start_date = datetime.strptime(
            f"{match.group('start_m')} {match.group('start_d')} {match.group('year')}",
            "%b %d %Y",
        ).replace(hour=hour, tzinfo=UTC)
        end_date = datetime.strptime(
            f"{match.group('start_m')} {match.group('end_d')} {match.group('year')}",
            "%b %d %Y",
        ).replace(hour=hour, tzinfo=UTC)
        return start_date, end_date
    match = re.match(pattern_1_year, date_string)
    if match:
        start_date = datetime.strptime(
            f"{match.group('start_m')} {match.group('start_d')} {match.group('year')}",
            "%b %d %Y",
        ).replace(hour=hour, tzinfo=UTC)
        end_date = datetime.strptime(
            f"{match.group('end_m')} {match.group('end_d')} {match.group('year')}",
            "%b %d %Y",
        ).replace(hour=hour, tzinfo=UTC)
        return start_date, end_date
    match = re.match(pattern_2_years, date_string)
    if match:
        start_date = datetime.strptime(
            f"{match.group('start_m')} {match.group('start_d')} {match.group('start_y')}",  # noqa: E501
            "%b %d %Y",
        ).replace(hour=hour, tzinfo=UTC)
        end_date = datetime.strptime(
            f"{match.group('end_m')} {match.group('end_d')} {match.group('end_y')}",
            "%b %d %Y",
        ).replace(hour=hour, tzinfo=UTC)
        return start_date, end_date
    return None


def documents_from_olx(
    olx_path: str, valid_file_types: list[str] = VALID_TEXT_FILE_TYPES
) -> Generator[tuple, None, None]:
    """
    Extract text from OLX directory

    Args:
        olx_path (str): The path to the directory with the OLX data

    Yields:
        tuple: A list of (bytes of content, metadata)
    """
    for root, _, files in os.walk(olx_path):
        path = "/".join(root.split("/")[3:])
        for filename in files:
            extension_lower = Path(filename).suffix.lower()

            if extension_lower in valid_file_types and "draft" not in root:
                with Path.open(Path(root, filename), "rb") as f:
                    filebytes = f.read()

                mimetype = mimetypes.types_map.get(extension_lower)
                archive_checksum = md5(filebytes).hexdigest()  # noqa: S324

                yield (
                    filebytes,
                    {
                        "content_type": CONTENT_TYPE_FILE,
                        "mime_type": mimetype,
                        "archive_checksum": archive_checksum,
                        "file_extension": extension_lower,
                        "source_path": f"{path}/{filename}",
                    },
                )


def get_edx_module_id(path: str, run: LearningResourceRun) -> str:
    """
    Return the XBlock ID from a path

    Args:
        path (str): The path to the file

    Returns:
        str: The XBlock ID
    """
    path = path.replace(" ", "_")
    folder = path.split("/")[-2]

    if folder == "static":
        name = Path(path).name
        key_type = "asset-v1"
        module_type = "asset"
    else:
        name = Path(path).stem
        key_type = "block-v1"
        module_type = folder

    return (
        f"{key_type}:{run.run_id.replace('course-v1:', '')}"
        f"+type@{module_type}+block@{name}"
    )


def text_from_srt_content(content: str):
    """
    Remove timestamps and other extraneous data from SRT content

    Args:
        content (str): The SRT content to clean

    Returns:
        str: The content as a string without timestamps
    """
    # Remove timestamps
    content = re.sub(
        r"\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}(\n|$)", "", content
    )
    # Remove sequence numbers
    content = re.sub(r"\d+\n", "", content)
    # Remove empty lines
    return re.sub(r"\n\s*\n", " ", content)


def text_from_sjson_content(content: str):
    """
    Return text from sjson content

    Args:
        content (str): The sjson content

    Returns:
        str: The content as a string without timestamps. if parse error
             is encountered, returns None
    """
    try:
        data = json.loads(content)
        return " ".join(data.get("text", []))
    except json.decoder.JSONDecodeError:
        log.exception("Error parsing sjson content")


def get_root_url_for_source(etl_source: str) -> tuple[str, str]:
    """
    Get the base URL and path for an ETL source

    Args:
        etl_source (str): The ETL source path

    Returns:
        tuple[str, str]: The base URL and path
    """
    mapping = {
        ETLSource.mitxonline.value: settings.CONTENT_BASE_URL_MITXONLINE,
        ETLSource.xpro.value: settings.CONTENT_BASE_URL_XPRO,
        ETLSource.oll.value: settings.CONTENT_BASE_URL_OLL,
        ETLSource.mit_edx.value: settings.CONTENT_BASE_URL_EDX,
    }
    return mapping.get(etl_source)


def is_valid_uuid(uuid_string: str) -> bool:
    """
    Check if a string is a valid UUID
    """
    try:
        uuid.UUID(uuid_string)
    except ValueError:
        return False
    return True


def get_url_from_module_id(
    module_id: str,
    run: LearningResourceRun,
    video_srt_metadata: dict | None = None,
) -> str:
    """
    Get the URL for a module based on its ID

    Args:
        module_id (str): The module ID
        run (LearningResourceRun): The run associated with the module

    Returns:
        str: The URL for the module
    """
    if not module_id:
        return None
    root_url = get_root_url_for_source(run.learning_resource.etl_source)
    # OLL needs to have 'course-v1:' added to the run_id
    run_id = (
        f"course-v1:{run.run_id}"
        if run.learning_resource.etl_source == ETLSource.oll.value
        else run.run_id
    )
    base_jump_url = f"{root_url}/courses/{run_id}/jump_to_id/"
    if module_id.startswith("asset"):
        video_meta = (
            video_srt_metadata.get(module_id, {}).get("module_id", {})
            if video_srt_metadata
            else {}
        )
        if video_meta:
            # Link to the parent video
            return f"{base_jump_url}{video_meta.split('@')[-1]}"
        return f"{root_url}/{module_id}"
    elif is_valid_uuid(module_id.rsplit("@", maxsplit=1)[-1]):
        return f"{base_jump_url}{module_id.rsplit('@', maxsplit=1)[-1]}"
    else:
        return None


def parse_video_transcripts_xml(
    run: LearningResourceRun, xml_content: str, path: Path
) -> dict:
    """
    Parse video XML content and create a mapping of
    transcript edx_module_id to video edx_module_id
    """
    transcript_mapping = {}
    try:
        root = ElementTree.fromstring(xml_content)

        # Get the video url_name from the root video element
        video_url_name = root.get("url_name")
        video_title = root.get("display_name")
        if not video_url_name:
            log.warning("No url_name found in video XML")
            return {}

        # Find all transcript elements and extract their src attributes
        for transcript in root.findall(".//transcript"):
            transcript_src = transcript.get("src")
            if transcript_src:
                transcript_mapping[
                    get_edx_module_id(f"static/{transcript_src}", run)
                ] = {
                    "module_id": get_edx_module_id(str(path), run),
                    "title": video_title,
                }
    except ElementTree.ParseError:
        msg = f"xml parsing error for {path!s}"
        log.debug(msg)
        return transcript_mapping
    return transcript_mapping


def get_video_metadata(olx_path: str, run: LearningResourceRun) -> dict:
    """
    Get metadata for video SRT/VTT files in an OLX path
    """
    video_transcript_mapping = {}
    video_path = Path(olx_path, "video")
    if not video_path.exists():
        log.debug("No video directory found in OLX path: %s", olx_path)
        return video_transcript_mapping

    for root, _, files in os.walk(str(Path(olx_path, "video"))):
        for filename in files:
            extension_lower = Path(filename).suffix.lower()
            if extension_lower == ".xml":
                with Path.open(Path(root, filename), "rb") as f:
                    video_xml = f.read().decode("utf-8")

                # Parse the XML and get transcript mappings
                transcript_mapping = parse_video_transcripts_xml(run, video_xml, f)
                video_transcript_mapping.update(transcript_mapping)
    return video_transcript_mapping


def _should_reprocess(existing_record, metadata: dict, overwrite) -> bool:
    """Determine if content needs to be reprocessed."""
    if not existing_record:
        return True
    if overwrite:
        return True
    return existing_record.archive_checksum != metadata.get("archive_checksum")


def _get_existing_record(source_path: str, key: str, run, is_tutor_problem):
    """Fetch existing record based on import type."""
    if is_tutor_problem:
        return TutorProblemFile.objects.filter(source_path=source_path, run=run).first()
    return ContentFile.objects.filter(key=key, run=run).first()


def _should_use_ocr(file_extension: str, file_path: Path, use_ocr) -> bool:
    """Check if OCR processing should be used for the file."""
    return (
        file_extension == ".pdf"
        and use_ocr
        and settings.OCR_MODEL
        and file_path.stat().st_size > 0
    )


def _extract_content_with_ocr(file_path: Path, is_tutor_problem) -> dict | None:
    """Extract content from PDF using OCR. Returns None if skipped."""
    try:
        page_count = len(PdfReader(file_path).pages)
        if page_count > settings.OCR_PDF_MAX_PAGE_THRESHOLD and not is_tutor_problem:
            return None
        return {
            "content": _pdf_to_markdown(file_path),
            "content_title": "",
        }
    except FileNotDecryptedError:
        log.exception("Skipping encrypted pdf %s", file_path)
        return None


def _extract_content_with_tika(
    document, mime_type: str | None, file_extension: str, key: str
) -> dict | None:
    """Extract content using Tika. Returns None if extraction fails."""
    headers = {"Content-Type": mime_type} if mime_type else {}
    tika_output = extract_text_metadata(document, other_headers=headers)

    if tika_output is None:
        log.info("No tika response for %s", key)
        return None

    content = (tika_output.get("content") or "").strip()
    content = _transform_content_by_type(content, file_extension)

    if not content:
        return None

    tika_metadata = tika_output.get("metadata") or {}
    return {
        "content": content,
        "content_title": tika_metadata.get("title", ""),
    }


def _transform_content_by_type(content: str, file_extension: str) -> str:
    """Apply file-type-specific content transformations."""
    transformers = {
        ".srt": text_from_srt_content,
        ".sjson": text_from_sjson_content,
    }
    transformer = transformers.get(file_extension)
    return transformer(content) if transformer else content


def _extract_content(  # noqa: PLR0913
    document,
    metadata: dict,
    olx_path: str,
    key: str,
    *,
    use_ocr=False,
    is_tutor_problem=False,
) -> dict | None:
    """Extract content from document using appropriate method."""
    if settings.SKIP_TIKA and settings.ENVIRONMENT != "production":
        return {"content": "", "content_title": ""}

    source_path = metadata.get("source_path")
    file_extension = metadata.get("file_extension")
    file_path = Path(olx_path) / Path(source_path)

    if _should_use_ocr(
        file_extension=file_extension, file_path=file_path, use_ocr=use_ocr
    ):
        return _extract_content_with_ocr(file_path, is_tutor_problem)

    content_dict = _extract_content_with_tika(
        document, metadata.get("mime_type"), file_extension, key
    )
    if content_dict:
        content_dict["content_title"] = (
            metadata.get("title") or content_dict["content_title"] or ""
        )[: get_max_contentfile_length("content_title")]

    return content_dict


def _get_cached_content(existing_record, is_tutor_problem) -> dict:
    """Get content from existing record."""
    return {
        "content": existing_record.content,
        "content_title": "" if is_tutor_problem else existing_record.content_title,
    }


def get_title_for_video(
    module_id: str,
    video_srt_metadata: dict | None = None,
) -> str:
    """
    Get the title for a video

    Args:
        module_id (str): The module ID

    Returns:
        str: The title for the module
    """
    if module_id and module_id.startswith("asset"):
        return (
            video_srt_metadata.get(module_id, {}).get("title", "")
            if video_srt_metadata
            else ""
        )

    return None


def _title_from_xml(xml_content):
    """
    Extract title from XML content
    """
    root = ElementTree.fromstring(xml_content)
    return root.get("display_name")


def get_title_for_content(
    content: str,
    olx_path: str,
    source_path: str,
    edx_module_id: str,
    video_srt_metadata: dict | None = None,
) -> str:
    """
    Get the title for a source path based on its module ID

    Args:
        source_path (str): The source path
        edx_module_id (str): The module ID

    Returns:
        str: The title for the source path
    """
    title = get_title_for_video(edx_module_id, video_srt_metadata)

    if source_path.endswith(".xml"):
        # Try to extract title from XML
        try:
            title = _title_from_xml(content)
        except ElementTree.ParseError:
            msg = f"Error parsing XML for title extraction for xml {olx_path}"
            log.debug(msg)
    elif source_path.endswith(".html"):
        # Try to extract title from HTML
        try:
            xml_path = Path(olx_path) / Path(source_path).with_suffix(".xml")
            if not xml_path.exists():
                xml_path = (
                    Path(olx_path) / "html" / Path(source_path).with_suffix(".xml").name
                )

            if xml_path.exists():
                with Path.open(xml_path, "rb") as f:
                    xml_content = f.read().decode("utf-8")
                    title = _title_from_xml(xml_content)
            html_content = content
            title_match = re.search(
                r"<title>(.*?)</title>", html_content, re.IGNORECASE
            )
            if title_match:
                return title_match.group(1).strip()

        except Exception:
            log.exception("Error parsing HTML for title extraction: %s", source_path)
    if title:
        return title
    # Fallback: derive title from source path
    return Path(source_path).stem.replace("_", " ").replace("-", " ").title()


def _build_result(  # noqa: PLR0913
    olx_path, metadata: dict, key: str, run, video_srt_metadata, content_dict: dict
) -> dict:
    """Build the final result dictionary."""
    source_path = metadata.get("source_path")
    edx_module_id = get_edx_module_id(source_path, run)
    data = {
        "key": key,
        "published": True,
        "content_type": metadata["content_type"],
        "archive_checksum": metadata.get("archive_checksum"),
        "file_extension": metadata.get("file_extension"),
        "source_path": source_path,
        "edx_module_id": edx_module_id,
        "url": get_url_from_module_id(edx_module_id, run, video_srt_metadata),
        **content_dict,
    }

    # resolve the title priority: metadata title > extracted title > derived title
    data["title"] = content_dict.get("content_title") or get_title_for_content(
        content_dict.get("content"),
        olx_path,
        source_path,
        edx_module_id,
        video_srt_metadata,
    )
    return data


def process_olx_path(  # noqa: PLR0913
    olx_path: str,
    run: LearningResourceRun,
    *,
    overwrite: bool,
    valid_file_types=VALID_TEXT_FILE_TYPES,
    is_tutor_problem_file_import=False,
    use_ocr=False,
) -> Generator[dict, None, None]:
    """Process OLX path and yield content dictionaries."""
    video_srt_metadata = get_video_metadata(olx_path, run)

    for document, metadata in documents_from_olx(
        olx_path, valid_file_types=valid_file_types
    ):
        source_path = metadata.get("source_path")
        key = get_edx_module_id(source_path, run)

        existing_record = _get_existing_record(
            source_path, key, run, is_tutor_problem_file_import
        )

        if _should_reprocess(existing_record, metadata, overwrite):
            content_dict = _extract_content(
                document,
                metadata,
                olx_path,
                key,
                use_ocr=use_ocr,
                is_tutor_problem=is_tutor_problem_file_import,
            )
            if content_dict is None:
                continue
        else:
            content_dict = _get_cached_content(
                existing_record, is_tutor_problem_file_import
            )

        yield _build_result(
            olx_path, metadata, key, run, video_srt_metadata, content_dict
        )


def transform_content_files(
    course_tarpath: Path, run: LearningResourceRun, *, overwrite: bool
) -> Generator[dict, None, None]:
    """
    Pass content to tika, then return JSON document with transformed content inside it

    Args:
        course_tarpath (str): The path to the tarball which contains the OLX
        run (LearningResourceRun): The run associated witb the content files

    Yields:
        dict: content from file
    """
    basedir = course_tarpath.name.split(".")[0]
    with TemporaryDirectory(prefix=basedir) as inner_tempdir:
        check_call(["tar", "xf", course_tarpath], cwd=inner_tempdir)  # noqa: S603,S607
        olx_path = glob.glob(inner_tempdir + "/*")[0]  # noqa: PTH207
        yield from process_olx_path(olx_path, run, overwrite=overwrite)


def get_s3_prefix_for_source(etl_source: str) -> str:
    """
    Get the S3 prefix for a given ETL source

    Args:
        etl_source(str): The ETL source
    Returns:
        str: The S3 prefix
    """
    prefix_mapping = {
        ETLSource.mit_edx.name: settings.EDX_COURSE_BUCKET_PREFIX,
        ETLSource.xpro.name: settings.XPRO_COURSE_BUCKET_PREFIX,
        ETLSource.mitxonline.name: settings.MITX_ONLINE_COURSE_BUCKET_PREFIX,
        ETLSource.oll.name: settings.OLL_COURSE_BUCKET_PREFIX,
        ETLSource.canvas.name: settings.CANVAS_COURSE_BUCKET_PREFIX,
    }
    prefix = prefix_mapping.get(etl_source)
    if not prefix:
        msg = f"No S3 prefix found for ETL source: {etl_source}"
        raise ValueError(msg)
    return prefix


def get_bucket_by_name(bucket_name: str) -> object:
    """
    Get an S3 Bucket by name

    Args:
        bucket_name(str): The name of the S3 bucket

    Returns:S
        boto3.Bucket: the S3 Bucket or None
    """
    if bucket_name:
        s3 = boto3.resource(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
        return s3.Bucket(bucket_name)
    return None


def calc_checksum(filename) -> str:
    """
    Return the md5 checksum of the specified filepath

    Args:
        filename(str): The path to the file to checksum
    Returns:
        str: The md5 checksum of the file
    """
    if zipfile.is_zipfile(filename):
        with zipfile.ZipFile(filename, "r") as zip_file:
            return str(
                hash(tuple(f"{zp.filename}:{zp.file_size}" for zp in zip_file.filelist))
            )
    with tarfile.open(filename, "r") as tgz_file:
        return str(hash(tuple(ti.chksum for ti in tgz_file.getmembers())))


def get_content_type(file_type: str) -> str:
    """
    Return the appropriate content type for a file type
    TODO: add more content types (text? spreadsheet?)

    Args:
        file_type (str): The file type

    Returns:
        str: The content type
    """
    if not file_type:
        return CONTENT_TYPE_FILE
    if file_type.startswith("video/"):
        return CONTENT_TYPE_VIDEO
    if file_type == "application/pdf":
        return CONTENT_TYPE_PDF
    return CONTENT_TYPE_FILE


def extract_valid_department_from_id(
    course_string: str,
    is_ocw: bool = False,  # noqa: FBT001, FBT002
) -> list[str]:
    """
    Extracts a department from course data and returns

    Args:
        course_string (str): course name as string

    Returns:
        department (str): parsed department string
    """  # noqa: D401
    num_pattern = r"^([0-9A-Za-z\-]+)\.*" if is_ocw else r"\+([^\.]*)\."
    department_string = re.search(num_pattern, course_string)
    if department_string:
        dept_candidate = department_string.groups()[0]
        # Some CMS-W department courses start with 21W, but we want to use CMS-W
        if dept_candidate == "21W":
            dept_candidate = "CMS-W"
        return [dept_candidate] if dept_candidate in DEPARTMENTS else []
    return []


def get_department_id_by_name(name: str) -> str:
    """
    Return a department id based on provided name

    Args:
        name (str): The department name

    Returns:
        str: The department id
    """
    reverse_dept_map = {v: k for k, v in DEPARTMENTS.items()}
    return reverse_dept_map.get(name)


def generate_course_numbers_json(
    course_num: str,
    extra_nums: list[str] | None = None,
    is_ocw: bool = False,  # noqa: FBT001, FBT002
) -> list[dict]:
    """
    Generate a dict containing info on course numbers and departments

    Args:
        course_num (str): primary course number
        extra_nums (list[str]): list of cross-listed course numbers
        is_ocw (bool): whether or not the course is an OCW course

    Returns:
        course_number_json (list[dict]): list of dicts containing course number info

    """
    course_number_json = []
    course_numbers = [course_num]
    if not extra_nums:
        extra_nums = []
    course_numbers.extend(extra_nums)
    for idx, num in enumerate(course_numbers):
        dept_id = extract_valid_department_from_id(num, is_ocw=is_ocw)
        if (
            dept_id
            and dept_id[0].isdigit()
            and len(dept_id[0]) == 1
            and num.startswith(dept_id[0])
        ):
            sort_coursenum = f"0{num}"
        else:
            sort_coursenum = num
        course_number_json.append(
            {
                "value": num,
                "listing_type": (
                    CourseNumberType.primary.value
                    if idx == 0
                    else CourseNumberType.cross_listed.value
                ),
                "department": (
                    {
                        "department_id": dept_id[0],
                        "name": DEPARTMENTS[dept_id[0]],
                    }
                    if dept_id
                    else None
                ),
                "sort_coursenum": sort_coursenum,
                "primary": idx == 0,
            }
        )
    return course_number_json


def update_course_numbers_json(course: Course):
    """
    Update the course_numbers JSON for a Course

    Args:
        course (Course): The Course to update
    """
    is_ocw = course.learning_resource.etl_source == ETLSource.ocw.name
    extra_nums = [
        num["value"]
        for num in course.course_numbers
        if num["listing_type"] == CourseNumberType.cross_listed.value
    ]
    course.course_numbers = generate_course_numbers_json(
        (
            course.learning_resource.readable_id.split("+")[0]
            if is_ocw
            else course.learning_resource.readable_id
        ),
        extra_nums=extra_nums,
        is_ocw=is_ocw,
    )
    course.save()


def most_common_topics(
    resources: list[LearningResource], max_topics: int = settings.OPEN_VIDEO_MAX_TOPICS
) -> list[dict]:
    """
    Get the most common topics from a list of resources

    Args:
        resources (list[LearningResource]): resources to get topics from
        max_topics (int): The maximum number of topics to return

    Returns:
        list of dict: The most common topic names
    """
    counter = Counter(
        [topic.name for resource in resources for topic in resource.topics.all()]
    )
    common_topics = dict(counter.most_common(max_topics)).keys()
    return [{"name": topic} for topic in common_topics]


def transform_delivery(resource_delivery: str) -> list[str]:
    """
    Return the correct format of the resource

    Args:
        document: course or program data

    Returns:
        str: format of the course/program

    """
    try:
        return [RESOURCE_DELIVERY_MAPPING[resource_delivery]]
    except KeyError:
        log.exception("Invalid delivery %s", resource_delivery)
        return [LearningResourceDelivery.online.name]


def parse_certification(offeror, runs_data):
    """Return true/false depending on offeror and run status"""
    if offeror != OfferedBy.mitx.name:
        return False
    return bool(
        [
            status
            for status in [
                run.get("status") for run in runs_data if run.get("published", True)
            ]
            if (status and status != RunStatus.archived.value)
        ]
    )


def iso8601_duration(duration_str: str) -> str | None:
    """
    Parse the duration from a string and return it in ISO-8601 format

    Args:
        duration_str (str): The duration as a string in one of various formats

    Returns:
        str: the duration in ISO-8601 format
    """
    if not duration_str:
        return None
    delta = parse_duration(duration_str)
    if delta is None:
        log.warning("Could not parse duration string %s", duration_str)
        return None

    hours, remainder = divmod(delta.total_seconds(), 3600)
    minutes, seconds = divmod(remainder, 60)

    if hours or minutes or seconds:
        hour_duration = f"{int(hours)}H" if hours else ""
        minute_duration = f"{int(minutes)}M" if minutes else ""
        second_duration = f"{int(seconds)}S" if seconds else ""
        return f"PT{hour_duration}{minute_duration}{second_duration}"
    return "PT0S"


def transform_price(amount: Decimal, currency: str = CURRENCY_USD) -> dict:
    """
    Transform the price data into a dict

    Args:
        amount (Decimal): The price amount
        currency (str): The currency code

    Returns:
        dict: The price data
    """
    return {
        "amount": amount,
        # Use pycountry.currencies to ensure the code is valid, default to USD
        "currency": currency if currencies.get(alpha_3=currency) else CURRENCY_USD,
    }


def parse_string_to_int(int_str: str) -> int | None:
    """
    Parse a string to an integer if possible

    Args:
        int_str(str): the string to parse

    Returns:
        int or None: an integer or None
    """
    try:
        return int(int_str)
    except (TypeError, ValueError):
        return None


def calculate_weeks(num: int, from_unit: str) -> int:
    """
    Transform any # of days or months to weeks

    Args:
        num (int): the numerical value
        from_unit (str): the time unit

    Returns:
        int: the number of weeks
    """
    if "day" in from_unit:
        return max(math.ceil(num / 5), 1)  # Assuming weekends should be excluded
    elif "month" in from_unit:
        return num * 4
    return num


def transform_interval(interval_txt: str) -> str | None:
    """
    Transform any interval units to standard English units
    Only languages currently supported are English and Spanish

    Args:
        interval_txt (str): the interval text

    Returns:
        str: the interval text with intervals translated to English
    """
    english_matches = re.search(
        rf"{'|'.join(TIME_INTERVAL_MAPPING.keys())}(\s|\/|$)",
        interval_txt,
        re.IGNORECASE,
    )
    if english_matches:
        return english_matches.group(0).lower()
    reverse_map = {
        interval: k for k, v in TIME_INTERVAL_MAPPING.items() for interval in v
    }
    other_matches = re.search(
        rf"{'|'.join(reverse_map.keys())}(\s|\/|$)", interval_txt, re.IGNORECASE
    )
    if other_matches:
        return reverse_map[other_matches.group(0).lower()]
    return None


def parse_resource_duration(duration_str: str) -> DurationConfig:
    """
    Standardize duration string and return it if it is valid,
    otherwise return an empty string

    Args:
        course_data (str): the course data

    Returns:
        DurationConfig: the standardized duration
    """
    if duration_str:
        duration_regex = re.compile(r"(\d+)\s*(to|-)*\s*(\d+)?\s*(\w+)?", re.IGNORECASE)
        interval = transform_interval(duration_str)
        match = duration_regex.match(duration_str.lower().strip())
        if match and interval:
            dmin = match.group(1)
            dmax = match.group(3)
            return DurationConfig(
                duration=duration_str,
                min_weeks=calculate_weeks(int(dmin), interval.lower()),
                max_weeks=calculate_weeks(
                    int(dmax or dmin),
                    interval.lower(),
                ),
            )
        else:
            log.warning("Invalid duration: %s", duration_str)
    return DurationConfig(duration=duration_str or "")


def parse_resource_commitment(commitment_str: str) -> CommitmentConfig:
    """
    Standardize time commitment value and return it if it is valid,
    otherwise return an empty string

    Args:
        course_data (str): the course data

    Returns:
        str: the standardized time commitment, min, and max in hours
    """
    if commitment_str:
        commitment_regex = re.compile(
            r"(\d+)\D+(\d+)?\s*(\w+)?",
            re.IGNORECASE,
        )
        match = commitment_regex.match(commitment_str.strip())
        if match:
            cmin = match.group(1)
            cmax = match.group(2)
            return CommitmentConfig(
                commitment=commitment_str,
                min_weekly_hours=int(cmin),
                max_weekly_hours=int(cmax if cmax else cmin),
            )
        else:
            log.warning("Invalid commitment: %s", commitment_str)
    return CommitmentConfig(commitment=commitment_str or "")


def _pdf_to_markdown(pdf_path):
    """
    Convert a PDF file to markdown using an llm
    """
    converter = OpenDataLoaderLLMConverter(pdf_path)
    return converter.convert_to_markdown()


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
