"""Which files of an exported OLX course tree to ingest, and which to skip"""

import copy
import html
import json
import logging
import os
import re
from bisect import bisect_left, bisect_right
from collections import defaultdict
from collections.abc import Iterable
from datetime import UTC, datetime
from functools import cached_property
from itertools import accumulate
from pathlib import Path
from typing import NamedTuple
from urllib.parse import unquote
from xml.etree.ElementTree import Element

from defusedxml import ElementTree
from django.conf import settings

from learning_resources.constants import VALID_TEXT_FILE_TYPES
from learning_resources.etl.constants import ETLSource
from learning_resources.models import LearningResourceRun, Unit, UnitContentFile

log = logging.getLogger(__name__)

REFERENCE_SCAN_EXTENSIONS = frozenset({".xml", ".html", ".htm", ".json", ".txt", ".md"})

# Asset manifests list every file in the export, and updates.items.json is
# mostly deleted announcements; neither describes current course content.
NON_CONTENT_OLX_FILES = (
    "policies/assets.json",
    "assets/assets.xml",
    "info/updates.items.json",
)

# A legacy transcript is named for its video's id rather than for anything the
# course text contains, so the id is the only link back to the block using it.
VIDEO_ID_ATTRIBUTES = ("sub", "youtube", "youtube_id_1_0")
LEGACY_TRANSCRIPT_RE = re.compile(
    r"^(?:[a-z]{2}(?:[-_][a-z]{2})?_)?subs_(.+)\.srt\.sjson$", re.IGNORECASE
)

# edX writes any character in an asset name but a letter, digit, ., - or % as
# _, so a run of them, or of _, compares equal to one _. A run with anything
# but _ in it is also where a name can start or end; _ alone is not, so
# final_exam.srt != exam.srt.
SEPARATORS = re.compile(r"(?:[^\w.\-]|_)+")
# _NameIndex looks names up by this many leading characters
NAME_PREFIX_LENGTH = 4

# Only Open Learning Library serves the about page; other platforms redirect
# it to the course home. Of what it shows, only the prose is content — effort
# and end date are single values, not prose.
ABOUT_PAGE_FILES = frozenset({"overview.html", "short_description.html"})

# Folders of course-wide pages rather than steps of the course: the about page,
# the tabs and the handouts. Their files make up the run's context unit.
OLX_CONTEXT_FOLDERS = ("about", "tabs", "info")
TRANSCRIPT_EXTENSIONS = frozenset({".srt", ".sjson", ".vtt"})
OLX_STRUCTURE_TAGS = frozenset({"sequential", "vertical"})
# Blocks whose child elements are blocks too. In any other block, like html,
# problem or video, the children are the block's own markup.
OLX_CONTAINER_TAGS = OLX_STRUCTURE_TAGS | frozenset(
    {"split_test", "conditional", "library_content", "randomize", "itembank"}
)
CONTEXT_UNIT_ID = "context"
# A chapter holding a single sequential titled like this is the course's
# introduction or conclusion: material about the course rather than a step in
# it, so its files go to the context unit. A welcome or wrap-up is never a
# lesson, so any title starting with one counts ("Welcome to 14.444x"). An
# introduction, overview or summary counts only as the whole title, since
# "Introduction to Probability", "Summary Statistics" and "Lecture 1 -
# Introduction" are lessons. Either may follow "Course" or "Module".
CONTEXT_SEQUENTIAL_TITLE_RE = re.compile(
    r"""
    ^(?:(?:course|module)\s+)?
    (?:
        (?:welcome|wrap[\s-]?up|wrapping\s+up|conclusions?|concluding)\b.*
        | (?:introduction|intro|overview|summary)
          (?:\s+(?:to|of)\s+(?:the|this)\s+(?:course|module))?
    )
    [\W_]*$
    """,
    re.IGNORECASE | re.VERBOSE,
)
# Sequentials with these titles describe the module around them rather than
# teach, so their files go to the context unit wherever they sit
CONTEXT_SEQUENTIAL_TITLES = frozenset({"module overview and learning goals"})


def get_edx_module_id(path: str, run: LearningResourceRun) -> str:
    """Return the XBlock ID for a path"""
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
    }
    return mapping.get(etl_source)


def get_jump_to_url(run: LearningResourceRun, url_name: str) -> str:
    """Return the LMS URL that opens the block with this url_name in a run"""
    root_url = get_root_url_for_source(run.learning_resource.etl_source)
    # OLL needs to have 'course-v1:' added to the run_id
    run_id = (
        f"course-v1:{run.run_id}"
        if run.learning_resource.etl_source == ETLSource.oll.value
        else run.run_id
    )
    return f"{root_url}/courses/{run_id}/jump_to_id/{url_name}"


def _without_dated_blocks(element: Element) -> Element:
    """
    Copy element minus its named, dated inline blocks, whose text is their own.
    An unnamed one stays its parent's: _blocks doesn't track it.
    """
    element = copy.deepcopy(element)
    for parent in list(element.iter()):
        for child in list(parent):
            if child.get("url_name") and _parse_olx_start(child.get("start")):
                parent.remove(child)
    return element


def _reference_text(element: Element) -> str:
    """Serialize element, undoing the extra escape tostring adds to CDATA"""
    return html.unescape(ElementTree.tostring(element, encoding="unicode"))


def _parse_olx_start(value: str | None) -> datetime | None:
    """Parse an OLX start as UTC; None if absent or unparsable (logged)"""
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
        # astimezone overflows on year 1 or 9999 with a non-UTC offset
        return parsed.astimezone(UTC) if parsed.tzinfo else parsed.replace(tzinfo=UTC)
    except (ValueError, OverflowError):
        log.warning("Ignoring unparsable OLX start attribute %r", value)
        return None


def _normalize_asset_ref(text: str) -> str:
    """Unescape and lowercase a filename, with each separator run as one _"""
    return SEPARATORS.sub("_", unquote(html.unescape(text)).lower()).strip("_")


def _reference_index(texts: list[str]) -> tuple[str, list[int]]:
    """
    Return normalized text and the offsets where a name can start; a name
    can end at the _ just before one
    """
    parts, starts, length = [], [0], 0
    for raw in texts:
        # newlines mark both ends of each text as places a name can start or end
        text = f"\n{unquote(html.unescape(raw)).lower()}\n"
        last = 0
        for separator in SEPARATORS.finditer(text):
            parts.append(text[last : separator.start()] + "_")
            length += len(parts[-1])
            if separator.group().strip("_"):
                starts.append(length)
            last = separator.end()
    return "".join(parts), starts


def _ends_at(blob: str, starts: list[int], end: int) -> bool:
    """
    Whether a name ending at end is followed by a break, after any periods
    that end a sentence; each break is the _ just before a start
    """
    index = bisect_left(starts, end + 1)
    if index == len(starts):
        return False
    gap = blob[end : starts[index]]
    return gap.endswith("_") and not gap[:-1].strip(".")


class _NameIndex:
    """
    Normalized names to find in _reference_index text. Each name start is
    looked up once, so a scan costs the same however many names there are.
    """

    def __init__(self, names: Iterable[str]):
        self._by_prefix: dict[str, set[str]] = defaultdict(set)
        self._short: dict[int, set[str]] = defaultdict(set)
        for name in names:
            if len(name) >= NAME_PREFIX_LENGTH:
                self._by_prefix[name[:NAME_PREFIX_LENGTH]].add(name)
            else:
                self._short[len(name)].add(name)

    def first_starts(self, blob: str, starts: list[int]) -> dict[str, int]:
        """
        Map each name blob spells all of between name breaks to the first name
        start it is spelled at, so final_exam.srt doesn't match exam.srt and
        notes.pdf.txt doesn't match notes.pdf
        """
        found: dict[str, int] = {}

        def spelled(name: str, start: int) -> bool:
            return name not in found and _ends_at(blob, starts, start + len(name))

        for start in starts:
            for name in self._by_prefix.get(
                blob[start : start + NAME_PREFIX_LENGTH], ()
            ):
                if blob.startswith(name, start) and spelled(name, start):
                    found[name] = start
            for length, names in self._short.items():
                name = blob[start : start + length]
                if name in names and spelled(name, start):
                    found[name] = start
        return found


def _refers_to(
    path: Path, found: dict[str, int], video_ids: set[str], *, guess=False
) -> bool:
    """
    Whether indexed text names path (found by _NameIndex.first_starts), or
    declares the video a legacy transcript is named for (any legacy
    transcript, with guess)
    """
    if _normalize_asset_ref(path.name) in found:
        return True
    legacy = LEGACY_TRANSCRIPT_RE.match(path.name)
    return legacy is not None and (
        guess or _normalize_asset_ref(legacy.group(1)) in video_ids
    )


def _parse_video_transcripts(
    run: LearningResourceRun, xml_content: str, path: Path
) -> dict:
    """Parse a video block's XML into transcript key -> {video key, title}"""
    transcript_mapping = {}
    try:
        root = ElementTree.fromstring(xml_content)

        video_url_name = root.get("url_name")
        video_title = root.get("display_name")
        if not video_url_name:
            log.warning("No url_name found in video XML")
            return {}

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
        log.debug("xml parsing error for %s", path)
    return transcript_mapping


def _is_context_sequential(unit: dict, chapter_size: int) -> bool:
    """Whether a sequential's unit belongs to the course context"""
    title = unit["title"]
    return " ".join(title.split()).casefold() in CONTEXT_SEQUENTIAL_TITLES or (
        chapter_size == 1
        and bool(CONTEXT_SEQUENTIAL_TITLE_RE.match(" ".join(title.split())))
    )


def _is_set(attribute: str, *elements) -> bool:
    return any(element.get(attribute) == "true" for element in elements)


def _visible_text(pointer, element, *, markup: bool) -> str:
    """
    Text a block contributes itself: its attributes, its own text and the text
    between its children, and with markup, everything in its subtree too,
    attributes included, since a component links assets from its markup. A
    container's children add their own when the walk reaches them, so a
    staff-only subtree, which the walk skips, adds nothing.
    """
    parts = [*pointer.attrib.values()]
    if element is not pointer:
        parts.extend(element.attrib.values())
    parts.append(element.text or "")
    for child in element:
        if markup and isinstance(child.tag, str):
            for node in child.iter():
                if isinstance(node.tag, str):
                    parts.extend(node.attrib.values())
                parts.append(node.text or "")
                if node is not child:
                    parts.append(node.tail or "")
        parts.append(child.tail or "")
    return " ".join(parts)


class _OlxBlock(NamedTuple):
    """A visible block of a sequential, as the unit builder sees it"""

    files: list[tuple[Path, str]]  # lesson files with their relation
    texts: list[str]  # visible text that can link a static asset
    video_ids: set[str]


class _StaticTarget(NamedTuple):
    """A static file a unit can link, with the names a link is matched on"""

    path: Path
    name: str  # normalized filename
    legacy_video_id: str | None  # normalized video id of a legacy transcript


class OlxArchive:
    """
    An OLX tree's ingestable files (paths), the ones learners can't reach
    (excluded), and when each releases (release_dates). Malformed XML
    raises on first access.
    """

    def __init__(
        self,
        root: str | Path,
        etl_source: str | None = None,
        *,
        valid_file_types: list[str] = VALID_TEXT_FILE_TYPES,
    ):
        """
        etl_source is the platform the archive came from. Only OLL serves the
        course about page, so about/ files are excluded for any other source,
        including None.
        """
        self.root = Path(root)
        self.etl_source = etl_source
        self.valid_file_types = valid_file_types
        # file names only, so the tree is never held in memory
        self._listings: dict[Path, dict[str, list[Path]]] = {}
        # static files each static text page names, scanned once per page
        self._links_by_page: dict[Path, set[Path]] = {}

    @cached_property
    def is_olx(self) -> bool:
        """Whether the tree is an OLX export, i.e. has a course.xml"""
        return (self.root / "course.xml").is_file()

    @cached_property
    def paths(self) -> list[Path]:
        """Text files to ingest: text_files minus excluded"""
        return [path for path in self.text_files if path not in self.excluded]

    @cached_property
    def excluded(self) -> set[Path]:
        """Files no learner can reach, plus settings and manifests (not content)"""
        if not self.is_olx:
            return set()
        excluded = set(self._unreachable)
        excluded.update(
            self.root / name
            for name in NON_CONTENT_OLX_FILES
            if (self.root / name).is_file()
        )
        referenced, unreferenced = self._static_references(excluded)
        excluded.update(unreferenced)
        # A hidden video's transcript may also be a visible video's, so put
        # back anything a reachable block still links.
        excluded.difference_update(referenced)
        # Settings rather than content, but what they name (textbooks, the
        # course image) is shown, so they were still read as references above
        excluded.update(self.root.glob("policies/**/*"))
        # Old-style announcements: Studio empties updates.html on save, so
        # what's left is legacy text that still counted as a reference above.
        excluded.update(self.root.glob("info/**/updates.html"))
        return excluded

    @cached_property
    def release_dates(self) -> dict[Path, datetime]:
        """
        Release date of each file whose every visible path is dated; empty for
        non-OLX trees and self-paced runs, which ignore block starts. Dates follow
        links through reachable static text pages; an undated route wins.
        """
        if not self.is_olx or (self._course_policy or {}).get("self_paced"):
            return {}
        dates = self._block_release_dates()
        if (self.root / "static").is_dir() and (dates or self._inline_dated):
            self._date_static_assets(dates)
        return dates

    def excluded_keys(self, run: LearningResourceRun) -> set[str]:
        """Keys of excluded files, minus any key an ingested path shares"""
        # each path is keyed once; the subtraction is needed because "foo bar.pdf"
        # and "foo_bar.pdf" share a key, and that row stays if either is ingested
        return {
            get_edx_module_id(str(path), run)
            for path in self.text_files
            if path in self.excluded
        } - {get_edx_module_id(str(path), run) for path in self.paths}

    def key_dates(self, run: LearningResourceRun) -> dict[str, datetime | None]:
        """
        Release date per ingested key (None if undated); on a collision the
        latest date wins
        """
        dates: dict[str, datetime | None] = {}
        for path in self.paths:
            key = get_edx_module_id(str(path), run)
            dates[key] = max(
                filter(None, (dates.get(key), self.release_dates.get(path))),
                default=None,
            )
        return dates

    def video_metadata(self, run: LearningResourceRun) -> dict:
        """Transcript key -> its video's key and title"""
        mapping = {}
        # yields nothing when there is no video/ dir
        for path in (self.root / "video").rglob("*"):
            if path.suffix.lower() == ".xml":
                mapping.update(
                    _parse_video_transcripts(
                        run, path.read_text(encoding="utf-8"), path
                    )
                )
        return mapping

    @cached_property
    def text_files(self) -> list[Path]:
        """Files with an ingestable suffix outside draft dirs, excluded or not"""
        return [
            Path(root, filename)
            for root, _, files in os.walk(self.root)
            if "draft" not in root
            for filename in files
            if Path(filename).suffix.lower() in self.valid_file_types
        ]

    # not cached, like _blocks: an inline export holds the whole tree here
    @property
    def _course(self) -> Element | None:
        """The root <course> pointer, or None when the tree is not an OLX export"""
        return self._parse_block("", "course")

    def _parse_block(self, tag: str, url_name: str) -> Element | None:
        """
        Parse <tag>/<url_name>.xml, returning None if missing. Malformed XML
        raises so a course is never ingested with unverified staff-only status.
        """
        try:
            return ElementTree.parse(self.root / tag / f"{url_name}.xml").getroot()
        except (FileNotFoundError, NotADirectoryError):
            return None

    # not cached, like _live_updates: parsed trees and file text would stay in
    # memory for as long as the archive does, i.e. through every extraction
    @property
    def _blocks(self) -> list[tuple[str, str, Element, bool, datetime | None, bool]]:
        """
        Named course blocks as (tag, url_name, element, staff_only, release,
        inline), each (tag, url_name, staff_only, release) once. release ignores
        the root <course>'s own start so an upcoming run stays indexed.
        """
        course = self._course
        if course is None:
            return []
        blocks = []
        seen: set[tuple[str, str, bool, datetime | None]] = set()
        stack = [(course, "course", course.get("url_name"), False, None)]
        while stack:
            pointer, tag, url_name, staff_only, release = stack.pop()
            # pointer file wins when present; otherwise the element is the block
            element = self._parse_block(tag, url_name) if url_name else None
            if element is None:
                element = pointer
            staff_only = staff_only or "true" in (
                pointer.get("visible_to_staff_only"),
                element.get("visible_to_staff_only"),
            )
            if tag != "course":
                # a set, so a pointer that is its own element is parsed (and
                # warned about) once
                starts = {pointer.get("start"), element.get("start")}
                release = max(
                    filter(None, [release, *map(_parse_olx_start, starts)]),
                    default=None,
                )
            if url_name:
                state = (tag, url_name, staff_only, release)
                if state in seen:
                    continue
                seen.add(state)
                blocks.append(
                    (tag, url_name, element, staff_only, release, element is pointer)
                )
            stack.extend(
                (child, child.tag, child.get("url_name"), staff_only, release)
                for child in element
            )
        return blocks

    def _block_files(
        self, tag: str, url_name: str | None, element: Element
    ) -> set[Path]:
        """
        Files belonging to one block: its own files, html body, transcripts. An
        unnamed inline block has no files of its own, but can still have the
        others.
        """
        files = self._files_named(tag, url_name) if url_name else set()
        if tag == "html" and element.get("filename"):
            files.update(self._files_named("html", element.get("filename")))
        if tag == "video":
            # a transcript the export doesn't have is skipped
            files.update(
                path
                for transcript in element.iter("transcript")
                if transcript.get("src")
                and (path := self.root / "static" / transcript.get("src")).is_file()
            )
        return files

    def _files_named(self, folder: str, name: str) -> set[Path]:
        """
        Return the files named <folder>/<name>.<ext>, without a glob: each
        directory is listed once, and name is not read as a pattern, so a
        url_name with [ still finds its file. Only the name before the last dot
        counts, so notes doesn't also take notes.extra.html.
        """
        path = self.root / folder / name
        if path.parent not in self._listings:
            listing = defaultdict(list)
            try:
                entries = list(os.scandir(path.parent))
            except (FileNotFoundError, NotADirectoryError):
                entries = []
            for entry in entries:
                if entry.is_file() and "." in entry.name:
                    listing[Path(entry.name).stem].append(Path(entry.path))
            self._listings[path.parent] = listing
        return set(self._listings[path.parent].get(path.name, ()))

    @cached_property
    def _staff_only(self) -> set[Path]:
        """Files of staff-only blocks no visible parent also holds"""
        staff_files: dict[tuple[str, str], set[Path]] = {}
        reachable: set[tuple[str, str]] = set()
        for tag, url_name, element, staff_only, _release, _inline in self._blocks:
            if staff_only:
                staff_files[tag, url_name] = self._block_files(tag, url_name, element)
            else:
                reachable.add((tag, url_name))
        return {
            path
            for block, files in staff_files.items()
            if block not in reachable
            for path in files
        }

    @cached_property
    def _course_policy(self) -> dict | None:
        """The course's policy.json entry, or None when it can't be read"""
        url_name = self._course.get("url_name") if self._course is not None else None
        try:
            policy = json.loads(
                (self.root / "policies" / url_name / "policy.json").read_text(
                    errors="ignore"
                )
            )
            policy_dict = policy[f"course/{url_name}"]
            return policy_dict if isinstance(policy_dict, dict) else None
        except (TypeError, OSError, ValueError, KeyError):
            return None

    @cached_property
    def _unreachable_tabs(self) -> set[Path]:
        """Tab pages hidden or missing from the tab list; none if it can't be read"""
        tabs = (self._course_policy or {}).get("tabs")
        if not isinstance(tabs, list):
            return set()
        # ponytail: a staff-only or hidden tab that visible content links to is
        # dropped too; check links to tab slugs if a course turns out to rely
        # on that
        reachable = {
            tab.get("url_slug")
            for tab in tabs
            if isinstance(tab, dict)
            and not (tab.get("course_staff_only") or tab.get("is_hidden"))
        }
        # recursive because edX also reads tab pages from a tabs/<url_name>/ folder
        return {
            path for path in self.root.glob("tabs/**/*") if path.stem not in reachable
        }

    @cached_property
    def _unreachable(self) -> set[Path]:
        """
        Pages no learner of the course can reach: staff-only subtrees, tab
        pages outside the navigation, and about pages the platform does not show.
        """
        unreachable = set(self._staff_only)
        unreachable.update(self._unreachable_tabs)
        unreachable.update(self._hidden_about_pages)
        return unreachable

    @cached_property
    def _hidden_about_pages(self) -> set[Path]:
        """Files under about/ that the platform does not show"""
        shown = ABOUT_PAGE_FILES if self.etl_source == ETLSource.oll.name else ()
        # recursive for the about/<url_name>/ folder edX also reads
        return {path for path in self.root.glob("about/**/*") if path.name not in shown}

    @cached_property
    def _static_names(self) -> _NameIndex:
        """_static_files' names, indexed once for every scan"""
        return _NameIndex(
            _normalize_asset_ref(path.name) for path in self._static_files
        )

    @cached_property
    def _static_files(self) -> list[Path]:
        """The files under static/, in path order"""
        return [
            path for path in sorted(self.root.glob("static/**/*")) if path.is_file()
        ]

    @cached_property
    def _reference_candidates(self) -> list[Path]:
        """Files whose text may refer to a static asset, before any are skipped"""
        candidates = []
        for path in self.root.rglob("*"):
            if (
                not path.is_file()
                or path.suffix.lower() not in REFERENCE_SCAN_EXTENSIONS
            ):
                continue
            relative = path.relative_to(self.root)
            if (
                relative.parts[0] == "static"
                or relative.as_posix() in NON_CONTENT_OLX_FILES
                or any("draft" in part for part in relative.parts[:-1])
            ):
                continue
            candidates.append(path)
        return candidates

    def _reference_sources(self, skip: set[Path]) -> list[Path]:
        """Files whose text may legitimately refer to a static asset"""
        return [path for path in self._reference_candidates if path not in skip]

    @property
    def _live_updates(self) -> str:
        """Text of announcements not marked deleted"""
        try:
            items = json.loads(
                (self.root / "info/updates.items.json").read_text(errors="ignore")
            )
        except (OSError, ValueError):
            return ""
        return "\n".join(
            item.get("content") or ""
            for item in items
            if isinstance(item, dict) and item.get("status") != "deleted"
        )

    # not cached, like _blocks: the elements hold their parsed subtrees
    @property
    def _inline_dated(self) -> dict[datetime, list[Element]]:
        """Dated, visible blocks held inline in another file, by release date"""
        inline: dict[datetime, list[Element]] = {}
        for _tag, _url_name, element, staff_only, release, is_inline in self._blocks:
            if is_inline and release is not None and not staff_only:
                inline.setdefault(release, []).append(element)
        return inline

    def _source(self, path: Path) -> tuple[str, set[str] | None]:
        """
        Return a reference source's text and video ids, minus its dated inline
        blocks. Ids are None for malformed XML, so callers keep every legacy
        transcript.
        """
        text = path.read_text(errors="ignore")
        if path.suffix.lower() != ".xml":
            return text, set()
        # parse the file, not the lenient text, so bad bytes still fail
        try:
            root = _without_dated_blocks(ElementTree.parse(path).getroot())
        except ElementTree.ParseError:
            log.warning("Malformed XML in %s, keeping all legacy transcripts", path)
            return text, None
        return _reference_text(root), self._video_ids_of(root)

    def _texts(
        self, sources: list[Path], elements: list[Element]
    ) -> tuple[list[str], set[str], bool]:
        """
        Return the texts and video ids of the files and inline blocks, and
        whether every file parsed
        """
        texts: list[str] = []
        ids: set[str] = set()
        complete = True
        for path in sources:
            text, found = self._source(path)
            texts.append(text)
            if found is None:
                complete = False
            else:
                ids |= found
        for element in elements:
            own = _without_dated_blocks(element)
            texts.append(_reference_text(own))
            ids |= self._video_ids_of(own)
        return texts, ids, complete

    @staticmethod
    def _video_ids_of(element: Element) -> set[str]:
        """Video ids declared under element"""
        ids = set()
        # iter() finds <video> whether it has its own file or sits inline
        for video in element.iter("video"):
            for attribute in VIDEO_ID_ATTRIBUTES:
                # youtube is a comma-separated "<speed>:<id>" list, the others
                # are bare ids
                for entry in (video.get(attribute) or "").split(","):
                    value = entry.split(":")[-1].strip()
                    if value:
                        ids.add(_normalize_asset_ref(value))
        return ids

    def _static_references(
        self, skip: set[Path], *, confirmed: bool = False
    ) -> tuple[set[Path], set[Path]]:
        """
        Split static/ files into (referenced, unreferenced) by whether text
        outside skip names them. Matching by filename catches asset key links
        too. Unknown video ids keep every legacy transcript. confirmed=True
        counts neither those guesses nor dated inline blocks.
        """
        if not (self.root / "static").is_dir():
            return set(), set()
        elements = (
            [] if confirmed else [e for es in self._inline_dated.values() for e in es]
        )
        texts, video_ids, complete = self._texts(
            self._reference_sources(skip), elements
        )
        texts.append(self._live_updates)
        found = self._static_names.first_starts(*_reference_index(texts))
        guess = not (confirmed or complete)

        referenced, unreferenced = set(), set()
        for path in self._static_files:
            if _refers_to(path, found, video_ids, guess=guess):
                referenced.add(path)
            else:
                unreferenced.add(path)
        return referenced, unreferenced

    def units(self, run: LearningResourceRun) -> list[dict]:
        """
        Break the course into units: one per visible sequential (subsection),
        in course-tree order, plus a context unit for the about page, tabs,
        handouts, the static files those link to, and the introduction,
        conclusion and module overview sequentials (see
        _is_context_sequential). A unit holds the ContentFile keys of its
        blocks, the html bodies and transcripts of those blocks, and the static
        files they link to. Sequentials that are staff-only or hidden from the
        table of contents, or in a chapter that is, produce no unit. Empty when
        the tree is not an OLX export.

        Args:
            run (LearningResourceRun): The run the units belong to

        Returns:
            list of dict: unit data for load_course_units, ``content_files``
                mapping each ContentFile key to its relation, in lesson order

        Raises:
            ValueError: the course, or a visible chapter or sequential, names a
                block file the export doesn't have
        """
        course_pointer = self._course
        if course_pointer is None:
            return []
        self._check_reference(course_pointer)
        course = self._resolve(course_pointer)
        course_file = self._block_file(course_pointer) or self.root / "course.xml"
        context_files = {
            get_edx_module_id(str(path), run): UnitContentFile.Relation.CORE
            for folder in OLX_CONTEXT_FOLDERS
            for path in sorted((self.root / folder).rglob("*"))
            if path.is_file() and path not in self.excluded
        }
        for path in self._context_static_files():
            context_files.setdefault(
                get_edx_module_id(str(path), run),
                UnitContentFile.Relation.SUPPLEMENTARY,
            )
        units = []
        # hide_from_toc is inherited, so _children skipping a hidden chapter
        # hides its sequentials
        for chapter_pointer, chapter in self._children(course, "chapter"):
            chapter_units = self._chapter_units(
                run, chapter, self._block_file(chapter_pointer) or course_file
            )
            for unit in chapter_units:
                if _is_context_sequential(unit, len(chapter_units)):
                    for key, relation in unit["content_files"].items():
                        context_files.setdefault(key, relation)
                else:
                    units.append(unit)
        units.append(
            {
                "external_id": CONTEXT_UNIT_ID,
                "kind": Unit.Kind.CONTEXT,
                "title": "Course context",
                "url": "",
                "content_files": context_files,
            }
        )
        return units

    @cached_property
    def _static_targets(self) -> list[_StaticTarget]:
        """
        The static files a unit can link: the ingested ones, as the rest have
        no ContentFile to link to. Names are normalized once for every unit.
        """
        targets = []
        for path in self._static_files:
            if path in self.excluded:
                continue
            legacy = LEGACY_TRANSCRIPT_RE.match(path.name)
            targets.append(
                _StaticTarget(
                    path,
                    _normalize_asset_ref(path.name),
                    _normalize_asset_ref(legacy.group(1)) if legacy else None,
                )
            )
        return targets

    @cached_property
    def _target_names(self) -> _NameIndex:
        """_static_targets' names, indexed once for every unit"""
        return _NameIndex(target.name for target in self._static_targets)

    def _block_file(self, pointer: Element) -> Path | None:
        """Return the file a pointer's block is stored in, or None if inline"""
        url_name = pointer.get("url_name")
        path = self.root / pointer.tag / f"{url_name}.xml"
        return path if url_name and path.is_file() else None

    def _resolve(self, pointer: Element) -> Element:
        """Return the block a pointer names: its own file if present, else it"""
        url_name = pointer.get("url_name")
        element = self._parse_block(pointer.tag, url_name) if url_name else None
        return pointer if element is None else element

    def _check_reference(self, pointer: Element):
        """
        Raise if a pointer names a block file the export doesn't have. Read as
        an empty inline block, it would make an incomplete outline replace the
        run's units. An inline block holds its children, so has no file to miss.
        """
        url_name = pointer.get("url_name")
        if url_name and not len(pointer) and self._block_file(pointer) is None:
            msg = f"{pointer.tag}/{url_name}.xml is missing"
            raise ValueError(msg)

    def _children(self, element: Element, tag: str):
        """
        Yield (pointer, block) for the children of an element with a tag that
        are neither staff-only nor hidden from the table of contents. Raises
        ValueError for such a child whose block file is missing; a hidden one
        produces no unit, so its file isn't needed.
        """
        for pointer in element:
            if pointer.tag != tag:
                continue
            block = self._resolve(pointer)
            if not _is_set("visible_to_staff_only", pointer, block) and not _is_set(
                "hide_from_toc", pointer, block
            ):
                self._check_reference(pointer)
                yield pointer, block

    def _chapter_units(
        self, run: LearningResourceRun, chapter: Element, container: Path | None
    ) -> list[dict]:
        """
        Build the units of a chapter's sequentials that a learner can navigate
        to. container is the file the chapter is stored in.
        """
        return [
            self._sequential_unit(run, pointer, sequential, container)
            for pointer, sequential in self._children(chapter, "sequential")
            if pointer.get("url_name")
        ]

    def _sequential_unit(
        self,
        run: LearningResourceRun,
        pointer: Element,
        sequential: Element,
        container: Path | None,
    ) -> dict:
        """Build the unit data for one sequential, whose pointer is in container"""
        url_name = pointer.get("url_name")
        files = self._unit_files(
            self._sequential_blocks(pointer, sequential, container)
        )
        return {
            "external_id": get_edx_module_id(f"sequential/{url_name}.xml", run),
            "kind": Unit.Kind.UNIT,
            "title": sequential.get("display_name")
            or pointer.get("display_name")
            or url_name,
            "url": get_jump_to_url(run, url_name),
            "content_files": {
                get_edx_module_id(str(path), run): relation
                for path, relation in files.items()
            },
        }

    def _sequential_blocks(
        self, pointer: Element, sequential: Element, container: Path | None
    ) -> list[_OlxBlock]:
        """
        Walk one sequential, returning its visible blocks in course-tree order.
        Staff-only subtrees are skipped, as in _staff_only. An outline file is
        a lesson only when it holds a component inline, since the component's
        text is then ingested under the outline file's key.

        Args:
            pointer: the sequential's pointer element
            sequential: the sequential's block, as _resolve returns it
            container (Path): the file the pointer element is in
        """
        blocks = []
        seen: set[tuple[str, str]] = set()
        # children are resolved when popped; the sequential already is
        stack = [
            (pointer, "sequential", pointer.get("url_name"), container, sequential)
        ]
        while stack:
            pointer, tag, block_name, container, element = stack.pop()
            if element is None:
                element = self._resolve(pointer)
            own_file = (
                None if element is pointer else self.root / tag / f"{block_name}.xml"
            )
            if _is_set("visible_to_staff_only", pointer, element):
                continue
            if tag in OLX_STRUCTURE_TAGS:
                self._check_reference(pointer)
            if block_name:
                if (tag, block_name) in seen:
                    continue
                seen.add((tag, block_name))
            relation = (
                UnitContentFile.Relation.ASSESSMENT
                if tag == "problem"
                else UnitContentFile.Relation.CORE
            )
            # the block's own file, then its html body, then its transcripts
            paths = sorted(
                self._block_files(tag, block_name, element),
                key=lambda path: (path.parent.name == "static", str(path)),
            )
            files = [] if tag in OLX_STRUCTURE_TAGS else [(p, relation) for p in paths]
            # an inline component's text is in the file that holds it, unless
            # it is an html block whose body has a file of its own
            has_body = tag == "html" and any(p.parent.name == "html" for p in paths)
            if (
                own_file is None
                and tag not in OLX_STRUCTURE_TAGS
                and container
                and not has_body
            ):
                files.append((container, relation))
            # XML is read from the walked elements, so staff-only descendants
            # are left out; other files of the block, like an html body, are
            # read whole
            is_container = tag in OLX_CONTAINER_TAGS
            texts = [_visible_text(pointer, element, markup=not is_container)] + [
                path.read_text(errors="ignore")
                for path in paths
                if path.suffix.lower() in REFERENCE_SCAN_EXTENSIONS
                and path.suffix.lower() != ".xml"
            ]
            blocks.append(
                _OlxBlock(
                    files=files,
                    texts=texts,
                    video_ids=self._video_ids_of(element) if tag == "video" else set(),
                )
            )
            # a component's children are its markup, read above, unless one
            # points at a block file of its own
            stack.extend(
                (child, child.tag, child.get("url_name"), own_file or container, None)
                for child in reversed(element)
                if isinstance(child.tag, str)
                and (is_container or self._block_file(child) is not None)
            )
        return blocks

    def _unit_files(self, blocks: list[_OlxBlock]) -> dict[Path, str]:
        """
        Order a unit's lesson files: each block's files in tree order, each
        static file the unit links to right after the first block linking it.
        Static files are matched the way _static_references matches them, so a
        unit gets an asset only when the ETL would also have found the reference.
        """
        linked = self._linked_targets(blocks) if self._static_targets else {}
        files: dict[Path, str] = {}
        for position, block in enumerate(blocks):
            for path, relation in block.files:
                files.setdefault(path, relation)
            for target in linked.get(position, ()):
                files.setdefault(
                    target.path,
                    UnitContentFile.Relation.CORE
                    if target.path.suffix.lower() in TRANSCRIPT_EXTENSIONS
                    else UnitContentFile.Relation.SUPPLEMENTARY,
                )
        return files

    def _linked_targets(
        self, blocks: list[_OlxBlock]
    ) -> dict[int, list[_StaticTarget]]:
        """
        Return the static targets a unit's blocks link, by the position of the
        first block linking each. The unit's text is indexed once; a link split
        across two blocks counts for the block it starts in.
        """
        indexes = [_reference_index(block.texts) for block in blocks]
        offsets = list(accumulate((len(blob) for blob, _ in indexes), initial=0))
        blob = "".join(blob for blob, _ in indexes)
        starts = [
            offset + start
            for offset, (_, block_starts) in zip(offsets, indexes, strict=False)
            for start in block_starts
        ]
        found = self._target_names.first_starts(blob, starts)
        own = {path for block in blocks for path, _ in block.files}
        linked: dict[int, list[_StaticTarget]] = defaultdict(list)
        for target in self._static_targets:
            if target.path in own:
                continue
            positions = []
            if target.name in found:
                position = bisect_right(offsets, found[target.name]) - 1
                positions.append(min(position, len(blocks) - 1))
            if target.legacy_video_id is not None:
                positions.extend(
                    position
                    for position, block in enumerate(blocks)
                    if target.legacy_video_id in block.video_ids
                )
            if positions:
                linked[min(positions)].append(target)
        return linked

    def _context_static_files(self) -> list[Path]:
        """
        Return the static files the course-wide pages link to: reachable tabs,
        the about pages the platform shows, handouts, and live announcements.
        Matched as _static_references matches them, from the same sources.
        """
        if not self._static_targets:
            return []
        skip = self._unreachable_tabs | self._hidden_about_pages
        texts = [
            path.read_text(errors="ignore")
            for path in self._reference_sources(skip)
            if path.relative_to(self.root).parts[0] in OLX_CONTEXT_FOLDERS
        ]
        texts.append(self._live_updates)
        found = self._target_names.first_starts(*_reference_index(texts))
        return [target.path for target in self._static_targets if target.name in found]

    def _block_release_dates(self) -> dict[Path, datetime]:
        """
        Date each file owned by a learner-visible block. A file is undated if
        any non-staff path to its block is undated, otherwise it takes the
        earliest.
        """
        dates: dict[Path, datetime] = {}
        undated: set[Path] = set()
        for tag, url_name, element, staff_only, release, _inline in self._blocks:
            if staff_only:
                continue
            files = self._block_files(tag, url_name, element)
            if release is None:
                undated.update(files)
            else:
                for path in files:
                    dates[path] = min(dates.get(path, release), release)
        for path in undated:
            dates.pop(path, None)
        return dates

    def _follow_static_pages(self, referenced: set[Path]) -> set[Path]:
        """Follow only reached text assets; visiting each once also breaks cycles."""
        pending = list(referenced)
        while pending:
            for path in self._page_links(pending.pop()) - referenced:
                referenced.add(path)
                pending.append(path)
        return referenced

    def _page_links(self, page: Path) -> set[Path]:
        """Return the static files a static text page names; empty for other files"""
        if page.suffix.lower() not in REFERENCE_SCAN_EXTENSIONS:
            return set()
        if page not in self._links_by_page:
            texts, video_ids, _complete = self._texts([page], [])
            found = self._static_names.first_starts(*_reference_index(texts))
            self._links_by_page[page] = {
                path
                for path in self._static_files
                if _refers_to(path, found, video_ids)
            }
        return self._links_by_page[page]

    def _date_static_assets(self, dates: dict[Path, datetime]) -> None:
        """
        Date static assets in place: undated if any undated visible file names
        one, else the earliest date of the files naming it
        """
        skip = set(dates) | self._unreachable
        # a guessed match keeps an asset ingested but must not mark it undated
        undated_refs, _ = self._static_references(skip, confirmed=True)
        undated_refs = self._follow_static_pages(undated_refs)
        for path in undated_refs:
            dates.pop(path, None)
        static_files = [path for path in self._static_files if path not in undated_refs]
        matched: set[Path] = set()
        inline = self._inline_dated
        # only the files the undated scan reads; transcripts can't link assets
        candidates = set(self._reference_candidates)
        for date in sorted(set(dates.values()) | set(inline)):
            files = [path for path, released in dates.items() if released == date]
            sources = [path for path in files if path in candidates]
            texts, video_ids, _complete = self._texts(sources, inline.get(date, []))
            found = self._static_names.first_starts(*_reference_index(texts))
            referenced = {
                path for path in static_files if _refers_to(path, found, video_ids)
            }
            for path in self._follow_static_pages(referenced) - undated_refs - matched:
                dates[path] = min(dates.get(path, date), date)
                matched.add(path)
