import json
import logging
import sys
import zipfile
from collections import defaultdict
from datetime import UTC
from pathlib import Path
from urllib.parse import unquote, unquote_plus
from zoneinfo import ZoneInfo

import dateutil
from bs4 import BeautifulSoup
from defusedxml import ElementTree
from django.conf import settings

from main.utils import now_in_utc

log = logging.getLogger(__name__)

# list of file regexes we should ignore
IGNORE_FILES = [
    "course_settings.xml",
    "context.xml",
    "files_meta.xml",
    "module_meta.xml",
    "imsmanifest.xml",
    "assignment_settings.xml",
]

NAMESPACES = {
    "cccv1p0": "http://canvas.instructure.com/xsd/cccv1p0",
    "imscp": "http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1",
    "lom": "http://ltsc.ieee.org/xsd/imsccv1p1/LOM/resource",
    "lomimscc": "http://ltsc.ieee.org/xsd/imsccv1p1/LOM/manifest",
}


def is_file_published(file_meta: dict) -> bool:
    """
    Determine if a Canvas file (from files_meta.xml) is published/visible to students.

    Args:
        file_meta (dict): Parsed metadata for a file.
    Returns:
        bool: True if file is published/visible, False otherwise.
    """

    hidden = str(file_meta.get("hidden", "false")).lower() == "true"
    locked = str(file_meta.get("locked", "false")).lower() == "true"
    unlock_at = file_meta.get("unlock_at")
    lock_at = file_meta.get("lock_at")
    visibility = file_meta.get("visibility", "inherit")
    # If explicitly hidden or locked → unpublished
    if hidden or locked:
        return False

    if is_date_locked(lock_at, unlock_at):
        return False
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
    try:
        for file_elem in root.findall(".//cccv1p0:file", NAMESPACES):
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
                # explicitly exclude files in web_resources/ai/tutor
                if file_data["published"] and not file.startswith(
                    settings.CANVAS_TUTORBOT_FOLDER
                ):
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
        if "course_settings/module_meta.xml" not in course_archive.namelist():
            return {"active": [], "unpublished": []}
        module_xml = course_archive.read("course_settings/module_meta.xml")
        manifest_xml = course_archive.read("imsmanifest.xml")
    resource_map = extract_resources_by_identifierref(manifest_xml)
    publish_status = {"active": [], "unpublished": []}
    try:
        root = ElementTree.fromstring(module_xml)
        for module in root.findall(".//cccv1p0:module", NAMESPACES):
            module_title = module.find("cccv1p0:title", NAMESPACES).text
            for item in module.findall("cccv1p0:items/cccv1p0:item", NAMESPACES):
                item_state = item.find("cccv1p0:workflow_state", NAMESPACES).text
                item_title = item.find("cccv1p0:title", NAMESPACES).text
                identifierref = (
                    item.find("cccv1p0:identifierref", NAMESPACES).text
                    if item.find("cccv1p0:identifierref", NAMESPACES) is not None
                    else None
                )
                content_type = item.find("cccv1p0:content_type", NAMESPACES).text
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


def _compact_element(element) -> dict | str | None:
    """Recursively compact an element into a nested dictionary"""
    if len(element) == 0:  # No children, return text
        return element.text.strip() if element.text else None
    return {
        child.tag.split("}")[-1] if "}" in child.tag else child.tag: _compact_element(
            child
        )
        for child in element
    }


def _workflow_state_from_html(html: str) -> str:
    """
    Extract the workflow_state meta tag from html
    """
    soup = BeautifulSoup(html, "html.parser")
    meta = soup.find("meta", attrs={"name": "workflow_state"})
    return meta.get("content") if meta else None


def _embedded_files_from_html(html: str) -> list[str]:
    """
    Extract Canvas file links from HTML, replacing $IMS-CC-FILEBASE$ with web_resources
    and returning URL-decoded paths without query params.
    """
    soup = BeautifulSoup(html, "html.parser")
    links = []

    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.startswith("$IMS-CC-FILEBASE$"):
            # Remove query parameters if present
            clean_href = href.split("?")[0]
            # Replace $IMS-CC-FILEBASE$ with "web_resources"
            clean_href = clean_href.replace("$IMS-CC-FILEBASE$", "web_resources")
            # URL decode
            decoded = unquote(clean_href)
            links.append(decoded)

    return links


def _workflow_state_from_xml(xml_string: str) -> bool:
    """
    Determine the workflow_state (published/unpublished) from assignment_settings.xml
    """

    def _get_text(tag):
        el = root.find(f"cccv1p0:{tag}", NAMESPACES)
        return el.text.strip() if el is not None and el.text else ""

    try:
        root = ElementTree.fromstring(xml_string)
    except Exception:
        log.exception("Error parsing XML: %s", sys.stderr)
        return "unpublished"

    if (
        (
            # workflow_state must be published
            _get_text("workflow_state") != "published"
        )
        or (
            # only_visible_to_overrides must not be true
            _get_text("only_visible_to_overrides") == "true"
        )
        or (
            # hide_in_gradebook must not be true (hidden from gradebook)
            _get_text("hide_in_gradebook") == "true"
        )
    ):
        return "unpublished"

    lock_at = _get_text("lock_at")
    unlock_at = _get_text("unlock_at")
    if _get_text("module_locked") == "true" or is_date_locked(lock_at, unlock_at):
        return "unpublished"

    return "published"


def _title_from_html(html: str) -> str:
    """
    Extract the title element from HTML content
    """
    soup = BeautifulSoup(html, "html.parser")
    title = soup.find("title")
    return title.get_text().strip() if title else ""


def _title_from_assignment_settings(xml_string: str) -> str:
    """
    Extract the title from assignment_settings.xml
    """
    try:
        root = ElementTree.fromstring(xml_string)
    except Exception:
        log.exception("Error parsing XML: %s", sys.stderr)
        return ""
    title_elem = root.find("cccv1p0:title", NAMESPACES)
    return title_elem.text.strip() if title_elem is not None and title_elem.text else ""


def parse_web_content(course_archive_path: str) -> dict:
    """
    Parse html pages and assignments and return publish/active status of resources
    """

    publish_status = {"active": [], "unpublished": []}
    course_settings = parse_canvas_settings(course_archive_path)
    public_syllabus_setting = course_settings.get("public_syllabus", "true").lower()
    public_syllabus_to_auth_setting = course_settings.get(
        "public_syllabus_to_auth", "true"
    ).lower()
    ingest_syllabus = True
    if (
        public_syllabus_setting == "false"
        and public_syllabus_to_auth_setting == "false"
    ):
        ingest_syllabus = False
    with zipfile.ZipFile(course_archive_path, "r") as course_archive:
        manifest_path = "imsmanifest.xml"
        if manifest_path not in course_archive.namelist():
            return publish_status
        manifest_xml = course_archive.read(manifest_path)
        resource_map = extract_resources_by_identifier(manifest_xml)

        for item in resource_map:
            resource_map_item = resource_map[item]
            item_link = resource_map_item.get("href")
            assignment_settings = None
            for file in resource_map_item.get("files", []):
                if file.endswith("assignment_settings.xml"):
                    assignment_settings = file
            if item_link and item_link.endswith(".html"):
                file_path = resource_map_item["href"]
                html_content = course_archive.read(file_path)
                embedded_files = _embedded_files_from_html(html_content)
                if assignment_settings:
                    xml_content = course_archive.read(assignment_settings)
                    workflow_state = _workflow_state_from_xml(xml_content)
                    title = _title_from_assignment_settings(xml_content)
                    canvas_type = "assignment"
                else:
                    workflow_state = _workflow_state_from_html(html_content)
                    title = _title_from_html(html_content)
                    canvas_type = "page"

                lom_elem = (
                    resource_map_item.get("metadata", {})
                    .get("lom", {})
                    .get("educational", {})
                )
                # Determine if the content is intended for authors or instructors only
                intended_role = lom_elem.get("intendedEndUserRole", {}).get("value")
                authors_only = intended_role and intended_role.lower() != "student"
                intended_use = resource_map_item.get("intendeduse", "")
                if (
                    workflow_state in ["active", "published"]
                    and not authors_only
                    and intended_use != "syllabus"
                ) or (ingest_syllabus and intended_use == "syllabus"):
                    publish_status["active"].append(
                        {
                            "title": title,
                            "path": file_path,
                            "canvas_type": canvas_type,
                            "embedded_files": embedded_files,
                        }
                    )
                else:
                    publish_status["unpublished"].append(
                        {
                            "title": title,
                            "path": file_path,
                            "canvas_type": canvas_type,
                            "embedded_files": embedded_files,
                        }
                    )
    return publish_status


def extract_resources_by_identifierref(manifest_xml: str) -> dict:
    """
    Extract resources from an IMS manifest file and
    return a map keyed by identifierref.
    """
    root = ElementTree.fromstring(manifest_xml)

    # Dictionary to hold resources keyed by identifierref
    resources_dict = defaultdict(list)
    # Find all item elements with identifierref attributes
    for item in root.findall(".//imscp:item[@identifierref]", NAMESPACES):
        identifierref = item.get("identifierref")

        title = (
            item.find("imscp:title", NAMESPACES).text
            if item.find("imscp:title", NAMESPACES) is not None
            else ""
        )
        resource = root.find(
            f'.//imscp:resource[@identifier="{identifierref}"]', NAMESPACES
        )
        if resource is not None:
            # Get all file elements within the resource
            files = [
                file_elem.get("href")
                for file_elem in resource.findall("imscp:file", NAMESPACES)
            ]

            resources_dict[identifierref].append(
                {
                    "title": title,
                    "files": files,
                    "type": resource.get("type"),
                    "intendeduse": resource.get("intendeduse"),
                }
            )
    return dict(resources_dict)


def extract_resources_by_identifier(manifest_xml: str) -> dict:
    """
    Extract resources from an IMS manifest
    file and return a map keyed by identifier.
    """
    root = ElementTree.fromstring(manifest_xml)
    resources_dict = {}
    # Find all resource elements
    for resource in root.findall(".//imscp:resource[@identifier]", NAMESPACES):
        identifier = resource.get("identifier")
        resource_type = resource.get("type")
        href = resource.get("href")

        # Get all file elements within the resource
        files = [
            file_elem.get("href")
            for file_elem in resource.findall("imscp:file", NAMESPACES)
        ]
        # Extract metadata if present
        metadata = {}
        metadata_elem = resource.find("imscp:metadata", NAMESPACES)
        if metadata_elem is not None:
            metadata.update(_compact_element(metadata_elem))
        resources_dict[identifier] = {
            "identifier": identifier,
            "type": resource_type,
            "href": href,
            "files": files,
            "metadata": metadata,
            "intendeduse": resource.get("intendeduse"),
        }
    return resources_dict


def parse_context_xml(course_archive_path: str) -> dict:
    """
    Parse course_settings/context.xml and return context info
    """
    with zipfile.ZipFile(course_archive_path, "r") as course_archive:
        if "course_settings/context.xml" not in course_archive.namelist():
            return {}
        context = course_archive.read("course_settings/context.xml")
    root = ElementTree.fromstring(context)
    context_info = {}
    item_keys = ["course_id", "root_account_id", "canvas_domain", "root_account_name"]
    for key in item_keys:
        element = root.find(f"cccv1p0:{key}", NAMESPACES)
        if element is not None:
            context_info[key] = element.text

    return context_info


def is_date_locked(lock_at: str, unlock_at: str) -> bool:
    """
    Determine if a resource is currently date-locked based
    on lock_at and unlock_at strings.
    Args:
        lock_at (str): ISO 8601 date string when the resource locks
        unlock_at (str): ISO 8601 date string when the resource unlocks
    Returns:
        bool: True if the resource is currently locked, False otherwise
    """
    now = now_in_utc()
    if unlock_at and unlock_at.lower() != "nil":
        try:
            unlock_dt = (
                dateutil.parser.parse(unlock_at)
                .replace(tzinfo=ZoneInfo("US/Eastern"))
                .astimezone(UTC)
            )

            if now < unlock_dt:
                return True
        except Exception:
            log.exception("Error parsing unlock_at date: %s", unlock_at)

    if lock_at and lock_at.lower() != "nil":
        try:
            lock_dt = (
                dateutil.parser.parse(lock_at)
                .replace(tzinfo=ZoneInfo("US/Eastern"))
                .astimezone(UTC)
            )
            if now > lock_dt:
                return True
        except Exception:
            log.exception("Error parsing lock_at date: %s", lock_at)
    return False


def parse_canvas_settings(course_archive_path):
    """
    Get course attributes from a Canvas course archive
    """
    with zipfile.ZipFile(course_archive_path, "r") as course_archive:
        settings_path = "course_settings/course_settings.xml"
        if settings_path not in course_archive.namelist():
            return {}
        xml_string = course_archive.read(settings_path)
    tree = ElementTree.fromstring(xml_string)
    attributes = {}
    for node in tree.iter():
        tag = node.tag.split("}")[1] if "}" in node.tag else node.tag
        node_value = node.text
        if tag == "tab_configuration":
            tab_config = json.loads(node.text)

            node_value = dict(zip([tc["id"] for tc in tab_config], tab_config))
        attributes[tag] = node_value
    return attributes


def canvas_url_config(bucket, export_tempdir: str, url_config_file: str) -> dict:
    """
    Get URL (citation) config from the metadata JSON file
    """
    url_config_path = Path(export_tempdir, url_config_file.rsplit("/", maxsplit=1)[-1])
    # download the url config file
    bucket.download_file(url_config_file, url_config_path)
    url_config = {}
    with Path.open(url_config_path, "rb") as f:
        url_json = json.loads(f.read().decode("utf-8"))
        for url_item in url_json.get("course_files", []):
            url_key = url_item["file_path"]
            url_key = unquote_plus(url_key.lstrip(url_key.split("/")[0]))
            url_config[url_key] = url_item
        for url_item in url_json.get("assignments", []) + url_json.get("pages", []):
            url_key = url_item.get("name", url_item.get("title"))
            # normalize url field
            url_item["url"] = url_item.get("html_url")
            url_config[url_key] = url_item
    return url_config


def canvas_course_url(course_archive_path) -> str:
    context_info = parse_context_xml(course_archive_path)
    return f"https://{context_info.get('canvas_domain')}/courses/{context_info.get('course_id')}/"


def _url_config_key(item):
    """
    Get the key to look up an item from the url_config dictionary
    """
    if "web_resources" in str(item["path"]):
        return str(item["path"]).split("web_resources")[-1]
    return item.get("title")


def _url_config_item_visible(item_configuration):
    """
    Determine if an item is visible based on its configuration
    from the metadata json file
    """
    if item_configuration:
        # check if explicitely unpublished
        unpublished = not item_configuration.get("published", True)
        lock_at = item_configuration.get("lock_at")
        unlock_at = item_configuration.get("unlock_at")
        return not any(
            [
                unpublished,
                is_date_locked(lock_at, unlock_at),
                item_configuration.get("hidden"),  # file hidden
                item_configuration.get("locked"),  # file locked
                item_configuration.get("folder", {}).get(
                    "hidden"
                ),  # parent folder hidden
                item_configuration.get("folder", {}).get(
                    "locked"
                ),  # parent folder locked
            ]
        )
    return True


def get_published_items(zipfile_path, url_config):
    """
    Get all published items from a Canvas course archive
    """
    published_items = {}
    course_settings = parse_canvas_settings(zipfile_path)
    tab_configuration = course_settings.get("tab_configuration", {})
    """
    mappings for ids:
    # https://developerdocs.instructure.com/services/dap/dataset/dataset-additional-notes
    """
    files_section_is_visible = not tab_configuration.get(11, {}).get("hidden", False)
    all_published_items = (
        parse_module_meta(zipfile_path)["active"]
        + parse_files_meta(zipfile_path)["active"]
        + parse_web_content(zipfile_path)["active"]
    )
    all_embedded_items = []
    for item in all_published_items:
        path = Path(item["path"]).resolve()
        item_configuration = url_config.get(_url_config_key(item))
        item_visible = _url_config_item_visible(item_configuration)

        # if the item is not explicitely hidden and global files section is visible
        if item_visible and (
            str(Path(item["path"]).parent) != "web_resources"
            or files_section_is_visible
            or item.get("module")
        ):
            published_items[path] = item
        for embedded_file in item.get("embedded_files", []):
            embedded_path = Path(embedded_file).resolve()
            embedded = {
                "path": embedded_path,
                "title": "",
            }
            all_embedded_items.append(embedded)
            if embedded_path in all_published_items:
                continue
            published_items[embedded_path] = embedded

    return published_items
