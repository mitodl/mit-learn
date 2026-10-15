"""Which files of an exported OLX course tree to ingest, and which to skip"""

import copy
import html
import json
import logging
import os
import re
from bisect import bisect_left
from datetime import UTC, datetime
from functools import cached_property
from itertools import accumulate
from pathlib import Path
from urllib.parse import unquote
from xml.etree.ElementTree import Element

from defusedxml import ElementTree

from learning_resources.constants import VALID_TEXT_FILE_TYPES
from learning_resources.etl.constants import ETLSource
from learning_resources.models import LearningResourceRun

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

# A reference spells an asset name with edX's punctuation substitutions (a
# space, +, or @ written as _) or without them, so punctuation is stripped
# before comparing, but still marks where a name can start.
NAME_BREAK = "\x00"
SEPARATORS = re.compile(r"(?:[^\w.\-]|_)+")

# Only Open Learning Library serves the about page; other platforms redirect
# it to the course home. Of what it shows, only the prose is content — effort
# and end date are single values, not prose.
ABOUT_PAGE_FILES = frozenset({"overview.html", "short_description.html"})


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


def _without_dated_blocks(element: Element) -> Element:
    """
    Copy element without the dated blocks held inline under it. Each of those
    names its assets at its own release, so its text is not its parent's.
    Only named blocks: _blocks tracks nothing else, so an unnamed one stays
    its parent's text rather than vanish.
    """
    element = copy.deepcopy(element)
    for parent in list(element.iter()):
        for child in list(parent):
            if child.get("url_name") and _parse_olx_start(child.get("start")):
                parent.remove(child)
    return element


def _reference_text(element: Element) -> str:
    """
    Serialize element as reference text. Serializing escapes text once more
    than the file did, which would double-escape CDATA, so undo that layer.
    """
    return html.unescape(ElementTree.tostring(element, encoding="unicode"))


def _parse_olx_start(value: str | None) -> datetime | None:
    """
    Parse an OLX start attribute as UTC. None when absent or unparsable
    (logged, not raised).
    """
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        # astimezone overflows on year 1 or 9999 with a non-UTC offset
        return parsed.astimezone(UTC) if parsed.tzinfo else parsed.replace(tzinfo=UTC)
    except (ValueError, OverflowError):
        log.warning("Ignoring unparsable OLX start attribute %r", value)
        return None


def _normalize_asset_ref(text: str) -> str:
    """Strip the punctuation of a filename that a reference may spell differently"""
    return SEPARATORS.sub("", unquote(html.unescape(text)).lower())


def _reference_index(texts: list[str]) -> tuple[str, list[int]]:
    """Return normalized text and the offsets where a name can start; _ is no break"""
    stripped = NAME_BREAK.join(
        SEPARATORS.sub(
            NAME_BREAK, unquote(html.unescape(text)).lower().replace("_", "")
        )
        for text in texts
    )
    segments = stripped.split(NAME_BREAK)
    return "".join(segments), list(accumulate(map(len, segments), initial=0))


def _name_starts_at(blob: str, starts: list[int], name: str) -> bool:
    """Whether blob spells name at a name start, so final_exam.srt != exam.srt"""
    start = blob.find(name)
    while start != -1:
        index = bisect_left(starts, start)
        if index < len(starts) and starts[index] == start:
            return True
        start = blob.find(name, start + 1)
    return False


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
        """etl_source decides whether the about page is shown; None hides it"""
        self.root = Path(root)
        self.etl_source = etl_source
        self.valid_file_types = valid_file_types
        # parsed once per file; the same XML is read for the exclusion scan and
        # again when static assets are dated
        self._sources_by_file: dict[Path, tuple[str, set[str] | None]] = {}

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
        The release date of each file whose every learner-visible path is
        dated. Empty for a tree that is not an OLX export and for a self-paced
        run, whose blocks are dated by its policy rather than by their starts.
        """
        if not self.is_olx or self._self_paced:
            return {}
        dates = self._block_release_dates()
        if (self.root / "static").is_dir():
            self._date_static_assets(dates)
        return dates

    def excluded_keys(self, run: LearningResourceRun) -> set[str]:
        """Keys of excluded files, minus any key an ingested path shares"""
        return {
            get_edx_module_id(str(path), run)
            for path in self.text_files
            if path in self.excluded
        } - {get_edx_module_id(str(path), run) for path in self.paths}

    def key_dates(self, run: LearningResourceRun) -> dict[str, datetime | None]:
        """
        Return the release date of every ingestable content file key, None
        for an undated one; the latest among colliding paths. A key the
        archive lacks is absent, so a stale row keeps whatever date it had
        until ingestion unpublishes it.
        """
        dates: dict[str, datetime | None] = {}
        for path in self.paths:
            key = get_edx_module_id(str(path), run)
            release_date = self.release_dates.get(path)
            dated = dates.get(key)
            dates[key] = (
                max(dated, release_date)
                if dated and release_date
                else dated or release_date
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

    @cached_property
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

    @cached_property
    def _blocks(self) -> list[tuple[str, str, Element, bool, datetime | None, bool]]:
        """
        Course tree blocks as (tag, url_name, element, staff_only, release,
        inline), once per distinct state. Pointer files win over inline
        elements; release ignores the root <course>'s own start so an
        upcoming run stays indexed.
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

    def _block_files(self, tag: str, url_name: str, element: Element) -> set[Path]:
        """Files belonging to one block: its own files, html body, transcripts"""
        files = set(self.root.glob(f"{tag}/{url_name}.*"))
        if tag == "html" and element.get("filename"):
            files.update(self.root.glob(f"html/{element.get('filename')}.*"))
        if tag == "video":
            files.update(
                self.root / "static" / transcript.get("src")
                for transcript in element.iter("transcript")
                if transcript.get("src")
            )
        return files

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
    def _self_paced(self) -> bool:
        """Whether the run's policy marks it self-paced; False if unreadable"""
        return bool(self._course_policy and self._course_policy.get("self_paced"))

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
        unreachable.update(self._unreachable_tabs())
        shown = ABOUT_PAGE_FILES if self.etl_source == ETLSource.oll.name else ()
        # recursive for the about/<url_name>/ folder edX also reads
        unreachable.update(
            path for path in self.root.glob("about/**/*") if path.name not in shown
        )
        return unreachable

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

    @cached_property
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

    @cached_property
    def _inline_dated(self) -> dict[datetime, list[Element]]:
        """
        Dated learner-visible blocks held inline in another file, by release.
        Dates what they name; their own text is still their parent file's.
        Studio writes every block to its own file, so only hand-authored OLX
        holds blocks inline.
        """
        inline: dict[datetime, list[Element]] = {}
        for _tag, _url_name, element, staff_only, release, is_inline in self._blocks:
            if is_inline and release is not None and not staff_only:
                inline.setdefault(release, []).append(element)
        return inline

    def _source(self, path: Path) -> tuple[str, set[str] | None]:
        """
        Return a reference source's text and the video ids it declares,
        without the dated blocks it holds inline (see _without_dated_blocks).
        Ids are None for malformed XML: "unknown", so callers keep every
        legacy transcript rather than drop one whose video they failed to read.
        """
        if path not in self._sources_by_file:
            text = path.read_text(errors="ignore")
            if path.suffix.lower() != ".xml":
                self._sources_by_file[path] = (text, set())
            else:
                # parse the file, not the lenient text, so bad bytes still fail
                try:
                    root = _without_dated_blocks(ElementTree.parse(path).getroot())
                except ElementTree.ParseError:
                    log.warning(
                        "Malformed XML in %s, keeping all legacy transcripts", path
                    )
                    self._sources_by_file[path] = (text, None)
                else:
                    self._sources_by_file[path] = (
                        _reference_text(root),
                        self._video_ids_of(root),
                    )
        return self._sources_by_file[path]

    def _texts(
        self, sources: list[Path], elements: list[Element] = ()
    ) -> tuple[list[str], set[str], bool]:
        """
        Return the given files' and inline blocks' texts, the video ids they
        declare, and whether every file could be read for ids
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
        self, skip: set[Path], *, inline: bool = True, guess: bool = True
    ) -> tuple[set[Path], set[Path]]:
        """
        Split static/ files into (referenced, unreferenced) by whether text
        outside skip names them. Matching by filename catches asset key links
        too. inline=False also ignores dated inline blocks. Unknown video ids
        keep every legacy transcript unless guess=False.
        """
        if not (self.root / "static").is_dir():
            return set(), set()
        elements = [e for es in self._inline_dated.values() for e in es]
        texts, video_ids, complete = self._texts(
            self._reference_sources(skip), elements if inline else []
        )
        texts.append(self._live_updates)
        blob, starts = _reference_index(texts)
        guess = guess and not complete

        referenced, unreferenced = set(), set()
        for path in self._static_files:
            if _name_starts_at(blob, starts, _normalize_asset_ref(path.name)) or (
                (legacy := LEGACY_TRANSCRIPT_RE.match(path.name))
                and (guess or _normalize_asset_ref(legacy.group(1)) in video_ids)
            ):
                referenced.add(path)
            else:
                unreferenced.add(path)
        return referenced, unreferenced

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

    def _date_static_assets(self, dates: dict[Path, datetime]) -> None:
        """
        Date static assets in place. An asset any undated learner-visible file
        names (including handouts, listed tabs, policies) is undated, even if a
        dated block owns it. Otherwise it takes the earliest date whose files
        name it. Pages learners cannot reach do not count.
        """
        skip = set(dates) | self._unreachable
        # confirmed references only: a guess may keep an asset ingested, but
        # must neither release one a dated block owns nor hide a shared one
        undated_refs, _ = self._static_references(skip, inline=False, guess=False)
        for path in undated_refs:
            dates.pop(path, None)
        static_files = [path for path in self._static_files if path not in undated_refs]
        matched: set[Path] = set()
        inline = self._inline_dated
        for date in sorted(set(dates.values()) | set(inline)):
            files = [path for path, released in dates.items() if released == date]
            existing = [path for path in files if path.is_file()]
            texts, video_ids, _complete = self._texts(existing, inline.get(date, []))
            blob, starts = _reference_index(texts)
            for path in static_files:
                if path in matched:
                    continue
                legacy = LEGACY_TRANSCRIPT_RE.match(path.name)
                if _name_starts_at(blob, starts, _normalize_asset_ref(path.name)) or (
                    legacy is not None
                    and _normalize_asset_ref(legacy.group(1)) in video_ids
                ):
                    dates[path] = min(dates.get(path, date), date)
                    matched.add(path)
