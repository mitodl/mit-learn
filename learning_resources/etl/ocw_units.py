"""Derive OCW course units from a run's content files"""

import logging
import re
from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass, field
from urllib.parse import unquote, urlparse

from bs4 import BeautifulSoup

from learning_resources.constants import (
    CONTENT_TYPE_PAGE,
    OCW_CONTENT_CATEGORY_PRACTICE_AND_ASSIGNMENT,
    OCW_COURSE_CONTENT_CATEGORY_MAPPING,
)
from learning_resources.etl.olx import CONTEXT_UNIT_ID
from learning_resources.models import ContentFile, Unit, UnitContentFile

log = logging.getLogger(__name__)

PAGES_FOLDER = "pages/"
RESOURCES_FOLDER = "resources/"

# top-level pages about the course as a whole rather than a step in it
CONTEXT_PAGE_SLUGS = {
    "syllabus",
    "calendar",
    "readings",
    "instructor-insights",
    "related-resources",
}
ASSESSMENT_CONTENT_TAGS = {
    tag
    for tag, category in OCW_COURSE_CONTENT_CATEGORY_MAPPING.items()
    if category == OCW_CONTENT_CATEGORY_PRACTICE_AND_ASSIGNMENT
} - {"Recitations", "Tutorials"}
REFERENCE_CONTENT_TAGS = {"Open Textbooks", "Readings"}


@dataclass
class PageLinks:
    """The content file keys a page's HTML links to, in document order"""

    next_page_key: str | None = None
    linked_page_keys: list[str] = field(default_factory=list)
    linked_resource_keys: list[str] = field(default_factory=list)


def build_units_from_content_files(content_files: Iterable[ContentFile]) -> list[dict]:
    """
    Group an OCW run's content files into ordered section units, a context
    unit and unordered bins

    Args:
        content_files (iterable of ContentFile): the run's published content files

    Returns:
        list of dict: unit data for load_course_units (see OlxArchive.units)
    """
    content_files_by_key = {
        content_file.key: content_file
        for content_file in content_files
        if content_file.key
    }
    page_keys = [
        key
        for key, content_file in content_files_by_key.items()
        if _is_course_page(content_file)
    ]
    if not page_keys:
        log.info(
            "No OCW pages to derive units from among %d content files",
            len(content_files_by_key),
        )
        return []
    course_path = _course_path_from_page_key(page_keys[0])
    page_links_by_key = {
        key: extract_page_links(content_files_by_key[key], course_path)
        for key in page_keys
    }
    context_page_keys, section_page_keys, other_top_level_page_keys = (
        classify_top_level_pages(page_keys, course_path)
    )
    if not section_page_keys:
        log.info(
            "OCW course %s has no section pages with sub-pages, so it gets "
            "context and bins but no ordered units. Top-level pages: %s",
            course_path,
            [
                _page_path(key, course_path)
                for key in context_page_keys + other_top_level_page_keys
            ],
        )

    section_units = [
        build_section_unit(section_page_key, page_links_by_key, content_files_by_key)
        for section_page_key in order_section_pages(
            section_page_keys, page_links_by_key, content_files_by_key
        )
    ]
    claimed_keys = {key for unit in section_units for key in unit["content_files"]}
    context_unit, page_bins = build_context_unit_and_page_bins(
        context_page_keys,
        other_top_level_page_keys,
        page_links_by_key,
        content_files_by_key,
        claimed_keys,
    )
    claimed_keys |= {
        key for unit in [context_unit, *page_bins] for key in unit["content_files"]
    }
    return [
        *section_units,
        context_unit,
        *page_bins,
        *build_leftover_bins(content_files_by_key, claimed_keys),
    ]


def extract_page_links(page: ContentFile, course_path: str) -> PageLinks:
    """
    Find the course pages and resources a page's HTML links to. The
    Previous/Next navigation links are kept apart from the page's own links.

    Args:
        page (ContentFile): an OCW page
        course_path (str): the course's key prefix, like "courses/<slug>/"

    Returns:
        PageLinks: the linked content file keys
    """
    page_links = PageLinks()
    soup = BeautifulSoup(page.content or "", "html.parser")
    for element in soup.select("[href], [src]"):
        key = content_file_key_from_link(
            element.get("href") or element.get("src"), course_path
        )
        if key is None:
            continue
        link_text = element.get_text(strip=True)
        if element.name == "a" and link_text == "Next":
            page_links.next_page_key = key
        elif element.name == "a" and link_text == "Previous":
            continue
        elif key.startswith(course_path + PAGES_FOLDER):
            page_links.linked_page_keys.append(key)
        else:
            page_links.linked_resource_keys.append(key)
    page_links.linked_page_keys = list(dict.fromkeys(page_links.linked_page_keys))
    page_links.linked_resource_keys = list(
        dict.fromkeys(page_links.linked_resource_keys)
    )
    return page_links


def content_file_key_from_link(link: str, course_path: str) -> str | None:
    """
    Return the key of the course page or resource a link points to, or None
    for anything else, like an inline file, another course or an external site
    """
    link_path = unquote(urlparse(link).path).strip("/")
    for folder_path in (course_path + PAGES_FOLDER, course_path + RESOURCES_FOLDER):
        if link_path.startswith(folder_path):
            return f"{link_path}/"
    return None


def classify_top_level_pages(
    page_keys: list[str], course_path: str
) -> tuple[list[str], list[str], list[str]]:
    """
    Split the top-level pages into context pages, section pages (ones with
    pages below them) and the rest
    """
    context_page_keys = []
    section_page_keys = []
    other_page_keys = []
    for page_key in sorted(page_keys):
        page_path = _page_path(page_key, course_path)
        if "/" in page_path:
            continue
        if page_path in CONTEXT_PAGE_SLUGS:
            context_page_keys.append(page_key)
        elif _has_descendant_pages(page_key, page_keys):
            section_page_keys.append(page_key)
        else:
            other_page_keys.append(page_key)
    return context_page_keys, section_page_keys, other_page_keys


def order_section_pages(
    section_page_keys: list[str],
    page_links_by_key: dict[str, PageLinks],
    content_files_by_key: dict[str, ContentFile],
) -> list[str]:
    """
    Order section pages by where they sit on the chain of Next links, then
    by title for any the chain doesn't reach
    """
    chain_index_by_key = _next_link_chain_index(page_links_by_key)
    return sorted(
        section_page_keys,
        key=lambda key: (
            key not in chain_index_by_key,
            chain_index_by_key.get(key, 0),
            _title_sort_key_with_numbers(content_files_by_key[key].title),
        ),
    )


def list_subtree_pages_in_order(
    root_page_key: str, page_links_by_key: dict[str, PageLinks]
) -> list[str]:
    """
    List a page and the pages below it, depth first in the order they're
    linked, then any that are never linked, by key
    """
    ordered_page_keys = []
    visited_page_keys = set()
    pages_to_visit = [root_page_key]
    while pages_to_visit:
        page_key = pages_to_visit.pop()
        if page_key in visited_page_keys:
            continue
        visited_page_keys.add(page_key)
        ordered_page_keys.append(page_key)
        child_page_keys = [
            key
            for key in page_links_by_key[page_key].linked_page_keys
            if key.startswith(root_page_key) and key in page_links_by_key
        ]
        pages_to_visit.extend(reversed(child_page_keys))
    unlinked_page_keys = sorted(
        key
        for key in page_links_by_key
        if key.startswith(root_page_key) and key not in visited_page_keys
    )
    return ordered_page_keys + unlinked_page_keys


def collect_content_files_for_pages(
    page_keys: list[str],
    page_links_by_key: dict[str, PageLinks],
    content_files_by_key: dict[str, ContentFile],
    excluded_keys: set[str],
) -> dict[str, str]:
    """
    Map each page, followed by the resources it links, to its relation,
    skipping excluded keys and links to files the run doesn't have
    """
    relations_by_key = {}
    for page_key in page_keys:
        for key in [page_key, *page_links_by_key[page_key].linked_resource_keys]:
            if (
                key in content_files_by_key
                and key not in excluded_keys
                and key not in relations_by_key
            ):
                relations_by_key[key] = relation_for_content_file(
                    content_files_by_key[key]
                )
    return relations_by_key


def relation_for_content_file(content_file: ContentFile) -> str:
    """Return how a content file relates to its unit, based on its content tags"""
    tag_names = {tag.name for tag in content_file.content_tags.all()}
    if tag_names & ASSESSMENT_CONTENT_TAGS:
        return UnitContentFile.Relation.ASSESSMENT
    if tag_names & REFERENCE_CONTENT_TAGS:
        return UnitContentFile.Relation.REFERENCE
    return UnitContentFile.Relation.CORE


def build_section_unit(
    section_page_key: str,
    page_links_by_key: dict[str, PageLinks],
    content_files_by_key: dict[str, ContentFile],
) -> dict:
    """Build the ordered unit for a section page and the pages below it"""
    content_files = collect_content_files_for_pages(
        list_subtree_pages_in_order(section_page_key, page_links_by_key),
        page_links_by_key,
        content_files_by_key,
        excluded_keys=set(),
    )
    # the section page is the unit's table of contents
    content_files[section_page_key] = UnitContentFile.Relation.REFERENCE
    section_page = content_files_by_key[section_page_key]
    return {
        "external_id": section_page_key,
        "kind": Unit.Kind.UNIT,
        "title": section_page.title,
        "url": section_page.url or "",
        "content_files": content_files,
    }


def build_context_unit_and_page_bins(
    context_page_keys: list[str],
    other_top_level_page_keys: list[str],
    page_links_by_key: dict[str, PageLinks],
    content_files_by_key: dict[str, ContentFile],
    claimed_keys: set[str],
) -> tuple[dict, list[dict]]:
    """
    Build the context unit from the context pages, and a bin for each other
    top-level page that links files no unit claimed. A page that links none
    goes into the context unit instead.
    """
    context_content_files = collect_content_files_for_pages(
        [
            page_key
            for context_page_key in context_page_keys
            for page_key in list_subtree_pages_in_order(
                context_page_key, page_links_by_key
            )
        ],
        page_links_by_key,
        content_files_by_key,
        excluded_keys=claimed_keys,
    )
    claimed_keys = claimed_keys | context_content_files.keys()
    page_bins = []
    for page_key in other_top_level_page_keys:
        bin_content_files = collect_content_files_for_pages(
            list_subtree_pages_in_order(page_key, page_links_by_key),
            page_links_by_key,
            content_files_by_key,
            excluded_keys=claimed_keys,
        )
        claimed_keys = claimed_keys | bin_content_files.keys()
        if all(key in page_links_by_key for key in bin_content_files):
            context_content_files.update(bin_content_files)
            continue
        page = content_files_by_key[page_key]
        page_bins.append(
            {
                "external_id": f"bin:{page_key}",
                "kind": Unit.Kind.BIN,
                "title": page.title,
                "url": page.url or "",
                "content_files": bin_content_files,
            }
        )
    context_unit = {
        "external_id": CONTEXT_UNIT_ID,
        "kind": Unit.Kind.CONTEXT,
        "title": "Course context",
        "url": "",
        "content_files": context_content_files,
    }
    return context_unit, page_bins


def build_leftover_bins(
    content_files_by_key: dict[str, ContentFile], claimed_keys: set[str]
) -> list[dict]:
    """Bin the files no unit claimed by content tag, or else by content type"""
    content_files_by_group = defaultdict(dict)
    for key, content_file in content_files_by_key.items():
        if (
            key in claimed_keys
            or content_file.content_type == CONTENT_TYPE_PAGE
            or (content_file.file_type or "").startswith("image/")
        ):
            continue
        group_name = _leftover_group_name(content_file)
        content_files_by_group[group_name][key] = relation_for_content_file(
            content_file
        )
    return [
        {
            "external_id": f"bin:{group_name}",
            "kind": Unit.Kind.BIN,
            "title": group_name,
            "url": "",
            "content_files": content_files,
        }
        for group_name, content_files in sorted(content_files_by_group.items())
    ]


def _is_course_page(content_file: ContentFile) -> bool:
    """Whether a content file is a titled page in the course's pages folder"""
    return (
        content_file.content_type == CONTENT_TYPE_PAGE
        and f"/{PAGES_FOLDER}" in content_file.key
        and bool(content_file.title)
    )


def _course_path_from_page_key(page_key: str) -> str:
    """Return the course's key prefix, like courses/<slug>/, from a page key"""
    return page_key.split(f"/{PAGES_FOLDER}", maxsplit=1)[0] + "/"


def _page_path(page_key: str, course_path: str) -> str:
    """Return a page key's path below the pages folder, like week-1/lesson-1"""
    return page_key.removeprefix(course_path + PAGES_FOLDER).strip("/")


def _has_descendant_pages(page_key: str, page_keys: list[str]) -> bool:
    """Whether any page sits below this one"""
    return any(key != page_key and key.startswith(page_key) for key in page_keys)


def _next_link_chain_index(
    page_links_by_key: dict[str, PageLinks],
) -> dict[str, int]:
    """
    Index pages in the order they're reached by following Next links,
    starting from each page that no other page's Next link points to
    """
    next_page_keys = {
        key: page_links.next_page_key
        for key, page_links in page_links_by_key.items()
        if page_links.next_page_key in page_links_by_key
    }
    chain_start_keys = sorted(set(next_page_keys) - set(next_page_keys.values()))
    chain_index_by_key = {}
    for chain_start_key in chain_start_keys:
        page_key = chain_start_key
        while page_key and page_key not in chain_index_by_key:
            chain_index_by_key[page_key] = len(chain_index_by_key)
            page_key = next_page_keys.get(page_key)
    return chain_index_by_key


def _title_sort_key_with_numbers(title: str | None) -> list:
    """Sort key that compares the numbers in a title by value, so Week 2 < Week 10"""
    # splitting on a captured group puts the numbers at the odd indexes
    return [
        int(part) if index % 2 else part.lower()
        for index, part in enumerate(re.split(r"(\d+)", title or ""))
    ]


def _leftover_group_name(content_file: ContentFile) -> str:
    """Name the leftover bin a file goes in: its first content tag or its type"""
    tag_names = sorted(tag.name for tag in content_file.content_tags.all())
    return tag_names[0] if tag_names else content_file.content_type
