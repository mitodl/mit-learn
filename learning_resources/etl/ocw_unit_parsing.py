"""Assemble course material from an MIT OpenCourseWare course site.

Mirrors the structure MIT Learn ingests from the OCW publishing bucket (course
data.json, pages, resources) but reads the public site because the bucket is not
reachable here. Produces the source manifest with stable ids, module/lesson structure
and extracted text.
"""

from __future__ import annotations

import hashlib
import json
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup, NavigableString, Tag

from learning_resources.etl.ocw_unit_parsing_fetchers import Fetcher
from learning_resources.profiles.schemas import Strict

MODULE_RE = re.compile(r"^(week-\d+|review-)")

MIN_CELL_COUNT = 3
MIN_NOTES_LENGTH = 200
MIN_TEXT_LENGTH = 40

_TS = re.compile(
    r"^(?:(\d+):)?(\d{2}):(\d{2})[.,](\d{3})\s+-->\s+"
)  # WebVTT may leave out the hours
_BOILERPLATE = (
    "Your browser does not support some features required to play this video",
    "You can also download the video to watch it offline",
    "View video page",
    "Download video",
    "Download transcript",
    "chevron_right",
    "chevron_left",
    "« Previous",
    "Next »",
    "Back English",
)

MaterialType = Literal[
    "course_page",
    "course_metadata",
    "syllabus",
    "syllabus_video_transcript",
    "readings_index",
    "assignments_index",
    "module_page",
    "lecture_transcript",
    "lecture_transcript_pdf",
    "worked_example_transcript",
    "problem_set",
    "textbook_chapter",
    "slides",
    "code",
    "exercise",
    "notes",
    "other",
]
RequiredStatus = Literal[
    "core", "review", "assessment", "supplementary", "reference", "unknown"
]
Status = Literal["extracted", "skipped", "failed", "missing", "unsupported"]


class SourceItem(Strict):
    """One piece of course material and the outcome of extracting its text."""

    source_id: str
    title: str
    material_type: MaterialType
    url: str  # page where the material is presented
    file_url: str | None = None  # the actual file (vtt/pdf) if any
    unit_id: str | None = None
    lesson_id: str | None = None
    lesson_title: str | None = None
    order: int
    required_status: RequiredStatus = "core"
    status: Status
    status_detail: str | None = None
    text_path: str | None = None
    sha256: str | None = None
    char_count: int = 0
    locator_kind: Literal["timestamp", "page", "section", "none"] = "none"
    used_for_extraction: bool = False


class Lesson(Strict):
    """A group of pages within a unit."""

    lesson_id: str
    title: str
    kind: Literal[
        "introduction",
        "lesson",
        "worked_examples",
        "problem_set",
        "deep_dive",
        "review",
        "slides_code",
        "exercises",
        "other",
    ]
    page_urls: list[str] = []
    source_ids: list[str] = []


class Unit(Strict):
    """A course unit (a week module or a lecture) and its lessons."""

    unit_id: str
    title: str
    order: int
    url: str
    role: Literal["core", "review"]
    lessons: list[Lesson] = []
    source_ids: list[str] = []
    assessment_source_ids: list[str] = []
    readings: list[str] = []  # readings assigned to this unit (from the Readings page)


class SourceManifest(Strict):
    """All sources and units assembled for a course."""

    kind: Literal["course", "video"] = (
        "course"  # video: one captioned video, units are its chapters
    )
    course_id: str
    course_url: str
    title: str
    generated_at: str
    sources: list[SourceItem]
    units: list[Unit]
    notes: list[str] = []

    def by_id(self) -> dict[str, SourceItem]:
        """Return the sources keyed by source_id."""
        return {s.source_id: s for s in self.sources}


def _render_text(node: NavigableString, out: list[str]) -> None:
    t = str(node)
    if t.strip():
        out.append(re.sub(r"\s+", " ", t))


def _render_table(node: Tag, out: list[str]) -> None:
    out.append("\n")
    for tr in node.find_all("tr"):
        cells = [
            re.sub(r"\s+", " ", c.get_text(" ", strip=True))
            for c in tr.find_all(["th", "td"])
        ]
        out.append("| " + " | ".join(cells) + " |\n")
    out.append("\n")


def _render(node: Tag | NavigableString, out: list[str]) -> None:
    if isinstance(node, NavigableString):
        _render_text(node, out)
        return
    name = node.name
    if name in ("script", "style", "nav", "button", "svg", "video", "iframe"):
        return
    if name in ("h1", "h2", "h3", "h4", "h5"):
        out.append(
            "\n\n"
            + "#" * min(int(name[1]), 4)
            + " "
            + node.get_text(" ", strip=True)
            + "\n"
        )
        return
    if name == "table":
        _render_table(node, out)
        return
    if name == "li":
        out.append("\n- ")
        for c in node.children:
            _render(c, out)
        return
    if name in ("p", "div", "ul", "ol", "br", "section", "article"):
        out.append("\n")
    for c in node.children:
        _render(c, out)
    if name in ("p", "div", "ul", "ol", "section", "article"):
        out.append("\n")


def _fmt(sec: float) -> str:
    s = int(sec)
    return f"{s // 3600:02d}:{(s % 3600) // 60:02d}:{s % 60:02d}"


def _vtt_cues(vtt: str) -> list[tuple[float, str]]:
    """Return the (start seconds, text) of each cue in a WebVTT file."""
    cues: list[tuple[float, str]] = []
    cur_start: float | None = None
    buf: list[str] = []
    for raw in [*vtt.splitlines(), ""]:
        line = raw.strip()
        m = _TS.match(line)
        if m:
            if cur_start is not None and buf:
                cues.append((cur_start, " ".join(buf)))
            h, mi, s, ms = (int(x or 0) for x in m.groups())
            cur_start, buf = h * 3600 + mi * 60 + s + ms / 1000, []
        elif line == "":
            if cur_start is not None and buf:
                cues.append((cur_start, " ".join(buf)))
            cur_start, buf = None, []
        elif cur_start is not None and not line.isdigit() and line != "WEBVTT":
            buf.append(re.sub(r"<[^>]+>", "", line))
    return cues


def vtt_to_text(vtt: str, block_seconds: int = 30) -> str:
    """Render a WebVTT file as '[hh:mm:ss] text'
    blocks merged over ~block_seconds windows.

    Cue text is kept verbatim (whitespace-normalised)
    so verbatim quotes still match.
    """
    blocks: list[str] = []
    bstart: float | None = None
    btext: list[str] = []
    last = None
    for start, text in _vtt_cues(vtt):
        if text == last:
            continue
        last = text
        if bstart is None:
            bstart = start
        if start - bstart >= block_seconds and btext:
            blocks.append(f"[{_fmt(bstart)}] " + " ".join(btext))
            bstart, btext = start, []
        btext.append(text)
    if btext and bstart is not None:
        blocks.append(f"[{_fmt(bstart)}] " + " ".join(btext))
    return "\n".join(blocks)


def pdf_to_text(path: Path) -> tuple[str, int]:
    """Extract PDF text with '[page N]' markers. Returns (text, page_count)."""
    import pymupdf

    doc = pymupdf.open(str(path))
    parts = []
    for i, page in enumerate(doc, start=1):
        txt = page.get_text("text")
        txt = re.sub(r"[ \t]+\n", "\n", txt)
        txt = re.sub(r"\n{3,}", "\n\n", txt).strip()
        parts.append(f"[page {i}]\n{txt}")
    n = len(doc)
    doc.close()
    return "\n\n".join(parts), n


def zip_to_text(path: Path, max_members: int = 40) -> tuple[str, list[str]]:
    """Extract text from a ZIP: PDFs (with page markers), .py/.txt/.md/.csv members.
    Returns (text, member names).
    """
    import tempfile
    import zipfile

    parts, names = [], []
    with zipfile.ZipFile(path) as z:
        for info in z.infolist()[:max_members]:
            name = info.filename
            if info.is_dir() or "__MACOSX" in name or Path(name).name.startswith("."):
                continue
            ext = Path(name).suffix.lower()
            data = z.read(info)
            names.append(name)
            if ext == ".pdf":
                with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                    tmp.write(data)
                txt, _ = pdf_to_text(Path(tmp.name))
                Path(tmp.name).unlink(missing_ok=True)
                parts.append(f"[file {Path(name).name}]\n{txt}")
            elif ext in (".py", ".txt", ".md", ".csv", ".json"):
                txt = (
                    data.decode("utf-8", errors="replace")
                    .replace("\r\n", "\n")
                    .replace("\r", "\n")
                )
                cap = (
                    60000 if ext in (".py", ".md") else 4000
                )  # data files (word lists etc.) are only sampled
                if len(txt) > cap:
                    txt = (
                        txt[:cap] + f"\n[... {Path(name).name} truncated: "
                        f"{len(txt):,} chars total ...]"
                    )
                parts.append(f"[file {Path(name).name}]\n{txt}")
            else:
                parts.append(f"[file {Path(name).name}] (binary, not extracted)")
    return "\n\n".join(parts), names


def html_main(html: str) -> Tag:
    soup = BeautifulSoup(html, "lxml")
    main = soup.find(id="course-content-section") or soup.find("main") or soup.body
    for sel in [
        "nav",
        ".course-pagination",
        ".video-player",
        "script",
        "style",
        "#video-transcript-panel",
    ]:
        for t in main.select(sel):
            t.decompose()
    return main


def html_to_text(html: str) -> str:
    main = html_main(html)
    out: list[str] = []
    _render(main, out)
    text = "".join(out)
    for b in _BOILERPLATE:
        text = text.replace(b, " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _slug(url: str) -> str:
    return urlparse(url).path.rstrip("/").split("/")[-1]


def _short(slug: str, n: int = 40) -> str:
    slug = re.sub(
        r"^[0-9a-f]{32}_", "", slug
    )  # OCW prefixes file names with a content hash
    slug = re.sub(r"[^a-z0-9]+", "-", slug.lower()).strip("-")
    return slug[:n].rstrip("-")


def _nav_find(nav: list[str], pat: str) -> str | None:
    return next((u for u in nav if re.search(pat, _slug(u))), None)


def _lesson_kind(role: str, heading: str, links: list[tuple[str, str]]) -> str:
    """Classify a module's group of lesson links by its heading."""
    hl = heading.lower()
    if role == "review":
        kind = "review"
    elif hl.startswith("lesson"):
        kind = "lesson"
    elif "worked example" in hl:
        kind = "worked_examples"
    elif "problem set" in hl:
        kind = "problem_set"
    elif "deep dive" in hl:
        kind = "deep_dive"
    elif any(t.lower().endswith("introduction") for _, t in links):
        kind = "introduction"
    else:
        kind = "other"
    return kind


class Ingestor:
    def __init__(
        self,
        course_url: str,
        data_dir: Path,
        *,
        include_readings: bool = False,
        refresh: bool = False,
        fetcher: Fetcher | None = None,
    ):
        self.course_url = course_url.rstrip("/") + "/"
        self.course_id = _slug(self.course_url)
        self.base = self.course_url
        self.course_dir = data_dir / self.course_id
        self.text_dir = self.course_dir / "text"
        self.text_dir.mkdir(parents=True, exist_ok=True)
        self.fetch = fetcher or Fetcher(self.course_dir / "raw", refresh=refresh)
        self.include_readings = include_readings
        self.sources: list[SourceItem] = []
        self.units: list[Unit] = []
        self.notes: list[str] = []
        self._seen_files: set[str] = set()
        self._order = 0

    # ------------------------------------------------------------------ helpers
    def _abs(self, href: str) -> str:
        return urljoin(self.base, href)

    def _store(self, source_id: str, text: str) -> tuple[str, str, int]:
        p = self.text_dir / f"{source_id}.txt"
        p.write_text(text, encoding="utf-8")
        return str(p), hashlib.sha256(text.encode()).hexdigest(), len(text)

    def _add(self, **kw) -> SourceItem:
        self._order += 1
        kw.setdefault("order", self._order)
        existing = {s.source_id for s in self.sources}
        if (
            kw["source_id"] in existing
        ):  # keep ids unique even if two pages share a slug
            base, n = kw["source_id"], 2
            while f"{base}-{n}" in existing:
                n += 1
            kw["source_id"] = f"{base}-{n}"
        item = SourceItem(**kw)
        self.sources.append(item)
        return item

    def _add_text_source(self, source_id: str, text: str, **kw) -> SourceItem:
        path, sha, n = self._store(source_id, text)
        if n < MIN_TEXT_LENGTH:
            return self._add(
                source_id=source_id,
                status="missing",
                status_detail="no extractable text",
                text_path=path,
                sha256=sha,
                char_count=n,
                **kw,
            )
        return self._add(
            source_id=source_id,
            status="extracted",
            text_path=path,
            sha256=sha,
            char_count=n,
            used_for_extraction=True,
            **kw,
        )

    def _add_failed(self, source_id: str, err: str, **kw) -> SourceItem:
        return self._add(
            source_id=source_id, status="failed", status_detail=err[:300], **kw
        )

    def _links(self, main, pattern: str) -> list[tuple[str, str]]:
        out, seen = [], set()
        for a in main.find_all("a", href=True):
            href = self._abs(a["href"])
            if re.search(pattern, href) and href not in seen:
                seen.add(href)
                out.append((href, a.get_text(" ", strip=True)))
        return out

    def _media_links(self, html: str) -> dict:
        soup = BeautifulSoup(html, "lxml")
        vtt = [self._abs(t["src"]) for t in soup.find_all(src=re.compile(r"\.vtt$"))]
        pdfs = [
            self._abs(a["href"]) for a in soup.find_all("a", href=re.compile(r"\.pdf$"))
        ]
        yt = [
            m.group(1)
            for m in re.finditer(r"youtube\.com/embed/([A-Za-z0-9_-]{6,})", html)
        ]
        res = [
            self._abs(a["href"])
            for a in soup.find_all("a", href=re.compile(r"/resources/[^/]+/?$"))
        ]
        zips = [
            self._abs(a["href"]) for a in soup.find_all("a", href=re.compile(r"\.zip$"))
        ]
        texts = [
            self._abs(a["href"])
            for a in soup.find_all("a", href=re.compile(r"\.(py|txt|md|csv|json)$"))
        ]
        return {
            "vtt": list(dict.fromkeys(vtt)),
            "pdf": list(dict.fromkeys(pdfs)),
            "zip": list(dict.fromkeys(zips)),
            "text": list(dict.fromkeys(texts)),
            "youtube": list(dict.fromkeys(yt)),
            "resources": list(dict.fromkeys(res)),
        }

    def _add_vtt(
        self, sid: str, url: str, file_url: str, mtype: str, **kw
    ) -> SourceItem | None:
        if file_url in self._seen_files:
            return None
        self._seen_files.add(file_url)
        try:
            text = vtt_to_text(self.fetch.text(file_url))
        except Exception as e:  # noqa: BLE001
            return self._add_failed(
                sid,
                str(e),
                url=url,
                file_url=file_url,
                material_type=mtype,
                locator_kind="timestamp",
                **kw,
            )
        return self._add_text_source(
            sid,
            text,
            url=url,
            file_url=file_url,
            material_type=mtype,
            locator_kind="timestamp",
            **kw,
        )

    def _add_pdf(
        self, sid: str, url: str, file_url: str, mtype: str, **kw
    ) -> SourceItem | None:
        if file_url in self._seen_files:
            return None
        self._seen_files.add(file_url)
        try:
            self.fetch.get(file_url)
            text, _pages = pdf_to_text(self.fetch.path_for(file_url))
        except Exception as e:  # noqa: BLE001
            return self._add_failed(
                sid,
                str(e),
                url=url,
                file_url=file_url,
                material_type=mtype,
                locator_kind="page",
                **kw,
            )
        return self._add_text_source(
            sid,
            text,
            url=url,
            file_url=file_url,
            material_type=mtype,
            locator_kind="page",
            **kw,
        )

    def _process_page(  # noqa: C901, PLR0912
        self, unit: Unit, lesson: Lesson, page_url: str, title: str
    ) -> None:
        """Classify one lesson/child page and register its materials."""
        slug = _short(_slug(page_url))
        base_id = f"{unit.unit_id}-{slug}"
        common = {
            "unit_id": unit.unit_id,
            "lesson_id": lesson.lesson_id,
            "lesson_title": lesson.title,
        }
        try:
            html = self.fetch.text(page_url)
        except Exception as e:  # noqa: BLE001
            item = self._add_failed(
                base_id,
                str(e),
                title=title,
                url=page_url,
                material_type="other",
                **common,
            )
            lesson.source_ids.append(item.source_id)
            return
        media = self._media_links(html)
        req = (
            "review"
            if unit.role == "review"
            else ("supplementary" if lesson.kind == "deep_dive" else "core")
        )
        added: list[SourceItem] = []
        yt_ids = set(media["youtube"])

        # Videos: use VTT captions as the transcript (timestamps),
        # PDF transcript as fallback.
        multi = len(media["vtt"]) > 1
        for vi, vtt in enumerate(media["vtt"], start=1):
            mtype = (
                "worked_example_transcript"
                if lesson.kind in ("worked_examples", "problem_set")
                else "lecture_transcript"
            )
            part = f"-part{vi}" if multi else ""
            it = self._add_vtt(
                f"{base_id}{part}-vtt",
                page_url,
                vtt,
                mtype,
                title=title + (f" (part {vi})" if multi else ""),
                required_status=req,
                **common,
            )
            if it:
                added.append(it)
        transcript_pdfs = (
            [p for p in media["pdf"] if any(y in p for y in yt_ids)] if yt_ids else []
        )
        for pi, p in enumerate(transcript_pdfs, start=1):
            part = f"-part{pi}" if len(transcript_pdfs) > 1 else ""
            if any(
                a.status == "extracted" and a.file_url and a.file_url.endswith(".vtt")
                for a in added
            ):
                if p not in self._seen_files:
                    self._seen_files.add(p)
                    added.append(
                        self._add(
                            source_id=f"{base_id}{part}-transcript-pdf",
                            title=f"{title} (transcript PDF)",
                            url=page_url,
                            file_url=p,
                            material_type="lecture_transcript_pdf",
                            status="skipped",
                            status_detail="superseded by VTT captions",
                            locator_kind="page",
                            required_status=req,
                            **common,
                        )
                    )
            else:
                it = self._add_pdf(
                    f"{base_id}{part}-transcript-pdf",
                    page_url,
                    p,
                    "lecture_transcript_pdf",
                    title=f"{title} (transcript PDF)",
                    required_status=req,
                    **common,
                )
                if it:
                    added.append(it)
        # Other PDFs linked directly (notes, problem sets).
        for p in media["pdf"]:
            if p in transcript_pdfs:
                continue
            mtype = (
                "problem_set"
                if lesson.kind == "problem_set" or "pset" in p.lower()
                else "notes"
            )
            it = self._add_pdf(
                f"{base_id}-{_short(Path(urlparse(p).path).stem, 30)}",
                page_url,
                p,
                mtype,
                title=title,
                required_status="assessment" if mtype == "problem_set" else req,
                **common,
            )
            if it:
                added.append(it)
        # Resource pages (e.g. problem set PDFs are linked via /resources/<name>/).
        added += self._page_resources(
            base_id, title, req, common, lesson, media["resources"]
        )
        if not added:
            text = html_to_text(html)
            if len(text) > MIN_NOTES_LENGTH:
                added.append(
                    self._add_text_source(
                        f"{base_id}-page",
                        text,
                        title=title,
                        url=page_url,
                        material_type="notes",
                        locator_kind="section",
                        required_status=req,
                        **common,
                    )
                )
            elif media["youtube"]:
                added.append(
                    self._add(
                        source_id=f"{base_id}-video",
                        title=title,
                        url=page_url,
                        material_type="other",
                        status="missing",
                        status_detail="video without caption transcript "
                        "(video processing out of scope)",
                        required_status=req,
                        **common,
                    )
                )
            else:
                added.append(
                    self._add(
                        source_id=f"{base_id}-page",
                        title=title,
                        url=page_url,
                        material_type="other",
                        status="missing",
                        status_detail="page has no transcript, PDF or substantive text",
                        required_status=req,
                        **common,
                    )
                )
        for it in added:
            lesson.source_ids.append(it.source_id)
            if it.material_type == "problem_set" and it.status == "extracted":
                unit.assessment_source_ids.append(it.source_id)

    def _page_resources(  # noqa: PLR0913, PLR0917
        self,
        base_id: str,
        title: str,
        req: str,
        common: dict[str, str],
        lesson: Lesson,
        resources: list[str],
    ) -> list[SourceItem]:
        """Register the captions or PDFs of resource pages a lesson page links."""
        added: list[SourceItem] = []
        for r in resources:
            try:
                rhtml = self.fetch.text(r)
            except Exception as e:  # noqa: BLE001
                added.append(
                    self._add_failed(
                        f"{base_id}-{_short(_slug(r))}",
                        str(e),
                        title=title,
                        url=r,
                        material_type="other",
                        **common,
                    )
                )
                continue
            rmedia = self._media_links(rhtml)
            rtitle = (
                BeautifulSoup(rhtml, "lxml")
                .title.get_text(" ", strip=True)
                .split("|")[0]
                .strip()
                if BeautifulSoup(rhtml, "lxml").title
                else title
            )
            if rmedia["vtt"]:
                for vtt in rmedia["vtt"]:
                    it = self._add_vtt(
                        f"{base_id}-{_short(_slug(r))}-vtt",
                        r,
                        vtt,
                        "worked_example_transcript",
                        title=rtitle,
                        required_status=req,
                        **common,
                    )
                    if it:
                        added.append(it)
                continue
            for p in rmedia["pdf"]:
                mtype = (
                    "problem_set"
                    if lesson.kind == "problem_set" or "pset" in p.lower()
                    else "notes"
                )
                it = self._add_pdf(
                    f"{base_id}-{_short(Path(urlparse(p).path).stem, 30)}",
                    r,
                    p,
                    mtype,
                    title=rtitle,
                    required_status="assessment" if mtype == "problem_set" else req,
                    **common,
                )
                if it:
                    added.append(it)
        return added

    def _add_zip(
        self, sid: str, url: str, file_url: str, mtype: str, **kw
    ) -> SourceItem | None:
        if file_url in self._seen_files:
            return None
        self._seen_files.add(file_url)
        try:
            self.fetch.get(file_url)
            text, _names = zip_to_text(self.fetch.path_for(file_url))
        except Exception as e:  # noqa: BLE001
            return self._add_failed(
                sid,
                str(e),
                url=url,
                file_url=file_url,
                material_type=mtype,
                locator_kind="section",
                **kw,
            )
        return self._add_text_source(
            sid,
            text,
            url=url,
            file_url=file_url,
            material_type=mtype,
            locator_kind="section",
            **kw,
        )

    def _add_from_resource(  # noqa: PLR0913, PLR0917
        self, unit: Unit, lesson: Lesson, rurl: str, title: str, hint: str, req: str
    ) -> list[SourceItem]:
        """Register whatever a /resources/ page offers.
        hint: lecture | solution | slides | code | problem_set | notes.
        """
        slug = _short(_slug(rurl))
        base_id = f"{unit.unit_id}-{slug}"
        common = {
            "unit_id": unit.unit_id,
            "lesson_id": lesson.lesson_id,
            "lesson_title": lesson.title,
        }
        try:
            html = self.fetch.text(rurl)
        except Exception as e:  # noqa: BLE001
            it = self._add_failed(
                base_id, str(e), title=title, url=rurl, material_type="other", **common
            )
            lesson.source_ids.append(it.source_id)
            return [it]
        media = self._media_links(html)
        soup_title = BeautifulSoup(html, "lxml").title
        rtitle = (
            soup_title.get_text(" ", strip=True).split("|")[0].strip()
            if soup_title
            else title
        )
        added: list[SourceItem] = []
        yt_ids = set(media["youtube"])
        for vi, vtt in enumerate(media["vtt"], start=1):
            part = f"-part{vi}" if len(media["vtt"]) > 1 else ""
            mtype = (
                "lecture_transcript"
                if hint == "lecture"
                else "worked_example_transcript"
            )
            it = self._add_vtt(
                f"{base_id}{part}-vtt",
                rurl,
                vtt,
                mtype,
                title=rtitle,
                required_status=req,
                **common,
            )
            if it:
                added.append(it)
        added += self._resource_pdfs(
            base_id, rurl, rtitle, req, common, media["pdf"], yt_ids, hint
        )
        for zp in media["zip"]:
            mtype = "problem_set" if hint == "problem_set" else "code"
            it = self._add_zip(
                f"{base_id}-zip",
                rurl,
                zp,
                mtype,
                title=rtitle,
                required_status=req,
                **common,
            )
            if it:
                added.append(it)
        added += self._resource_text_files(
            base_id, rurl, rtitle, req, common, media["text"]
        )
        if not added and media["youtube"]:
            added.append(
                self._add(
                    source_id=f"{base_id}-video",
                    title=rtitle,
                    url=rurl,
                    material_type="other",
                    status="missing",
                    status_detail="video without caption transcript "
                    "(video processing out of scope)",
                    required_status=req,
                    **common,
                )
            )
        elif not added:
            added.append(
                self._add(
                    source_id=f"{base_id}-resource",
                    title=rtitle,
                    url=rurl,
                    material_type="other",
                    status="unsupported",
                    status_detail="resource page offers no vtt/pdf/zip",
                    required_status=req,
                    **common,
                )
            )
        for it in added:
            lesson.source_ids.append(it.source_id)
            if it.material_type == "problem_set" and it.status == "extracted":
                unit.assessment_source_ids.append(it.source_id)
        return added

    def _resource_pdfs(  # noqa: PLR0913, PLR0917
        self,
        base_id: str,
        rurl: str,
        rtitle: str,
        req: str,
        common: dict[str, str],
        pdfs: list[str],
        yt_ids: set[str],
        hint: str,
    ) -> list[SourceItem]:
        """Register a resource page's PDFs, skipping video transcripts."""
        added: list[SourceItem] = []
        for p in pdfs:
            if yt_ids and any(y in p for y in yt_ids):
                if p not in self._seen_files:
                    self._seen_files.add(p)
                    added.append(
                        self._add(
                            source_id=f"{base_id}-transcript-pdf",
                            title=f"{rtitle} (transcript PDF)",
                            url=rurl,
                            file_url=p,
                            material_type="lecture_transcript_pdf",
                            status="skipped",
                            status_detail="superseded by VTT captions",
                            locator_kind="page",
                            required_status=req,
                            **common,
                        )
                    )
                continue
            mtype = {
                "slides": "slides",
                "problem_set": "problem_set",
                "code": "code",
            }.get(hint, "notes")
            it = self._add_pdf(
                f"{base_id}-pdf",
                rurl,
                p,
                mtype,
                title=rtitle,
                required_status=req,
                **common,
            )
            if it:
                added.append(it)
        return added

    def _resource_text_files(  # noqa: PLR0913, PLR0917
        self,
        base_id: str,
        rurl: str,
        rtitle: str,
        req: str,
        common: dict[str, str],
        files: list[str],
    ) -> list[SourceItem]:
        """Register the plain text files (code, data) a resource page links."""
        added: list[SourceItem] = []
        for tf in files:
            if tf in self._seen_files:
                continue
            self._seen_files.add(tf)
            fname = Path(urlparse(tf).path).name
            try:
                body = self.fetch.text(tf)
                added.append(
                    self._add_text_source(
                        f"{base_id}-{_short(fname, 30)}",
                        f"[file {fname}]\n{body}",
                        title=f"{rtitle} ({fname})",
                        url=rurl,
                        file_url=tf,
                        material_type="code" if fname.endswith(".py") else "notes",
                        locator_kind="section",
                        required_status=req,
                        **common,
                    )
                )
            except Exception as e:  # noqa: BLE001
                added.append(
                    self._add_failed(
                        f"{base_id}-{_short(fname, 30)}",
                        str(e),
                        title=rtitle,
                        url=rurl,
                        file_url=tf,
                        material_type="code",
                        **common,
                    )
                )
        return added

    def _session_table(
        self, html: str
    ) -> dict[int, list[tuple[str, list[tuple[str, str]]]]]:
        """Parse a 'SES #' style table:
        session number -> [(cell text, [(href, link text)]), ...] for the other cells.
        """
        rows: dict[int, list] = {}
        for tr in html_main(html).find_all("tr"):
            cells = tr.find_all(["td", "th"])
            if not cells:
                continue
            m = re.match(r"^(\d+)$", cells[0].get_text(" ", strip=True))
            if not m:
                continue
            row = []
            for c in cells[1:]:
                links = [
                    (self._abs(a["href"]), a.get_text(" ", strip=True))
                    for a in c.find_all("a", href=True)
                ]
                row.append((re.sub(r"\s+", " ", c.get_text(" ", strip=True)), links))
            rows[int(m.group(1))] = row
        return rows

    def _lecture_layout(self, nav: list[str], page_html: dict[str, str]) -> bool:  # noqa: C901, PLR0912, PLR0915
        """Units = numbered lecture video resources (OCW 'lecture-N-...' pages);
        attach slides/code, in-class questions,
        problem sets released at that session (syllabus calendar),
        and readings by session number.
        """
        try:
            sm = self.fetch.text(self.course_url + "sitemap.xml")
        except Exception:  # noqa: BLE001
            return False
        urls = re.findall(r"<loc>([^<]+)</loc>", sm)
        lectures: dict[int, str] = {}
        for u in urls:
            m = re.search(r"/resources/lecture-(\d+)(?:-[^/]*)?/?$", u)
            if m:
                lectures.setdefault(int(m.group(1)), u)
        if not lectures:
            return False
        # Session-indexed tables from the course pages.
        readings = (
            self._session_table(page_html.get("COURSE-readings", ""))
            if page_html.get("COURSE-readings")
            else {}
        )
        calendar = (
            self._session_table(page_html.get("COURSE-syllabus", ""))
            if page_html.get("COURSE-syllabus")
            else {}
        )
        slides_url = next(
            (u for u in nav if re.search(r"slides|notes", _slug(u))), None
        )
        slides = self._session_table(self.fetch.text(slides_url)) if slides_url else {}
        icq_root = next((u for u in nav if "question" in _slug(u)), None)
        icq_pages = {
            int(m.group(1)): u
            for u in urls
            if icq_root
            and (
                m := re.match(re.escape(icq_root.rstrip("/")) + r"/lecture-(\d+)/?$", u)
            )
        }
        # Problem sets: number -> resource url (from the assignments page),
        # release session from the calendar.
        psets: dict[int, str] = {}
        if page_html.get("COURSE-assignments"):
            for href, _t in self._links(
                html_main(page_html["COURSE-assignments"]), r"/resources/[^/]+/?$"
            ):
                m = re.search(r"ps(?:et)?[_-]?(\d+)", _slug(href), re.I)
                if m:
                    psets.setdefault(int(m.group(1)), href)
        released: dict[int, list[int]] = {}
        for ses, row in calendar.items():
            for text, _links in row:
                for m in re.finditer(
                    r"(?:Pset|Problem Set|PS)\s*(\d+)\s*(?:released|out|assigned)",
                    text,
                    re.I,
                ):
                    released.setdefault(ses, []).append(int(m.group(1)))
        assigned_psets = {n for lst in released.values() for n in lst}

        for i, (n, lurl) in enumerate(sorted(lectures.items())):
            uid = f"U{n:02d}"
            try:
                lhtml = self.fetch.text(lurl)
                t = BeautifulSoup(lhtml, "lxml").title
                title = (
                    t.get_text(" ", strip=True).split("|")[0].strip()
                    if t
                    else f"Lecture {n}"
                )
            except Exception:  # noqa: BLE001
                title = f"Lecture {n}"
            unit = Unit(unit_id=uid, title=title, order=i, url=lurl, role="core")
            lec = Lesson(
                lesson_id=f"{uid}-L01",
                title=f"{title} (lecture video)",
                kind="lesson",
                page_urls=[lurl],
            )
            unit.lessons.append(lec)
            self._add_from_resource(unit, lec, lurl, title, "lecture", "core")
            if n in slides:
                les = Lesson(
                    lesson_id=f"{uid}-L02",
                    title="Lecture slides and code",
                    kind="slides_code",
                )
                unit.lessons.append(les)
                for _text, links in slides[n]:
                    for href, ltext in links:
                        if "/resources/" not in href:
                            continue
                        hint = (
                            "code" if re.search(r"code|zip", ltext, re.I) else "slides"
                        )
                        les.page_urls.append(href)
                        self._add_from_resource(unit, les, href, ltext, hint, "core")
            if n in icq_pages:
                les = Lesson(
                    lesson_id=f"{uid}-L03",
                    title="In-class questions and video solutions",
                    kind="exercises",
                    page_urls=[icq_pages[n]],
                )
                unit.lessons.append(les)
                try:
                    qhtml = self.fetch.text(icq_pages[n])
                    common = {
                        "unit_id": uid,
                        "lesson_id": les.lesson_id,
                        "lesson_title": les.title,
                    }
                    it = self._add_text_source(
                        f"{uid}-in-class-questions-page",
                        html_to_text(qhtml),
                        title=f"In-class questions for Lecture {n}",
                        url=icq_pages[n],
                        material_type="exercise",
                        locator_kind="section",
                        required_status="core",
                        **common,
                    )
                    les.source_ids.append(it.source_id)
                    for vi, vtt in enumerate(self._media_links(qhtml)["vtt"], start=1):
                        it = self._add_vtt(
                            f"{uid}-in-class-solution-{vi}-vtt",
                            icq_pages[n],
                            vtt,
                            "worked_example_transcript",
                            title=f"Lecture {n} in-class question video solution {vi}",
                            required_status="core",
                            **common,
                        )
                        if it:
                            les.source_ids.append(it.source_id)
                except Exception as e:  # noqa: BLE001
                    self.notes.append(
                        f"in-class questions page failed for lecture {n}: {e}"
                    )
            for pn in released.get(n, []):
                if pn in psets:
                    les = Lesson(
                        lesson_id=f"{uid}-PS{pn:02d}",
                        title=f"Problem Set {pn} (released at session {n})",
                        kind="problem_set",
                        page_urls=[psets[pn]],
                    )
                    unit.lessons.append(les)
                    self._add_from_resource(
                        unit,
                        les,
                        psets[pn],
                        f"Problem Set {pn}",
                        "problem_set",
                        "assessment",
                    )
            if readings.get(n):
                unit.readings = (
                    [f"Session {n} ({readings[n][0][0]}): {readings[n][-1][0]}"]
                    if len(readings[n]) > 1
                    else [readings[n][0][0]]
                )
            unit.source_ids = [
                source_id for lesson in unit.lessons for source_id in lesson.source_ids
            ]
            self.units.append(unit)
        # Problem sets with no release session:
        # keep them visible as a separate assessment unit.
        leftover = sorted(set(psets) - assigned_psets)
        if leftover:
            unit = Unit(
                unit_id="UPS",
                title="Problem sets not tied to a lecture on the course site",
                order=len(self.units),
                url=self.course_url,
                role="core",
            )
            for pn in leftover:
                les = Lesson(
                    lesson_id=f"UPS-PS{pn:02d}",
                    title=f"Problem Set {pn}",
                    kind="problem_set",
                    page_urls=[psets[pn]],
                )
                unit.lessons.append(les)
                self._add_from_resource(
                    unit,
                    les,
                    psets[pn],
                    f"Problem Set {pn}",
                    "problem_set",
                    "assessment",
                )
            unit.source_ids = [
                source_id for lesson in unit.lessons for source_id in lesson.source_ids
            ]
            self.units.append(unit)
        self.notes.append(
            f"lecture layout: {len(lectures)} lectures; "
            f"problem sets released by session: {released}"
        )
        return True

    # ------------------------------------------------------------------ modules
    def _parse_module(self, unit: Unit, html: str) -> None:
        main = html_main(html)
        groups: list[tuple[str, list[tuple[str, str]]]] = []
        for h in main.find_all(["h2", "h3", "h4"]):
            heading = h.get_text(" ", strip=True)
            if not heading or heading in ("Course Info", "Learning Resource Types"):
                continue
            ul = h.find_next_sibling(["ul", "ol"])
            if ul is None:
                continue
            links = []
            for a in ul.find_all("a", href=True):
                href = self._abs(a["href"])
                if f"/pages/{_slug(unit.url)}/" in href and href.rstrip(
                    "/"
                ) != unit.url.rstrip("/"):
                    links.append((href, a.get_text(" ", strip=True)))
            if links:
                groups.append((heading, links))
        if not groups:  # flat module (e.g. Review: Vectors)
            links = [
                (u, t)
                for u, t in self._links(
                    main, rf"/pages/{re.escape(_slug(unit.url))}/.+"
                )
                if t not in ("Next", "Previous", "Next »", "« Previous")
            ]
            groups = [(unit.title, links)]
        for gi, (heading, links) in enumerate(groups, start=1):
            hl = heading.lower()
            kind = _lesson_kind(unit.role, heading, links)
            m = re.match(r"lesson\s+(\d+)", hl)
            lid = (
                f"{unit.unit_id}-L{int(m.group(1)):02d}"
                if m
                else f"{unit.unit_id}-G{gi:02d}"
            )
            lesson = Lesson(
                lesson_id=lid, title=heading, kind=kind, page_urls=[u for u, _ in links]
            )
            unit.lessons.append(lesson)
            for url, title in links:
                self._process_page(unit, lesson, url, title)
        unit.source_ids = [
            source_id for lesson in unit.lessons for source_id in lesson.source_ids
        ]

    # ------------------------------------------------------------------ readings
    def _parse_readings(self, html: str) -> tuple[dict[str, list[str]], list[str]]:
        """Map unit title (e.g. 'Week 1: Kinematics') ->
        readings strings; also chapter refs.
        """
        main = html_main(html)
        per_unit: dict[str, list[str]] = {}
        current = "Review: Vectors"
        for tr in main.find_all("tr"):
            cells = [
                re.sub(r"\s+", " ", c.get_text(" ", strip=True))
                for c in tr.find_all(["td", "th"])
            ]
            if not cells:
                continue
            joined = " ".join(cells)
            if re.match(r"^Week \d+", joined):
                current = re.sub(r"\s*\|.*$", "", joined).strip()
                continue
            if len(cells) >= MIN_CELL_COUNT and cells[0].isdigit():
                per_unit.setdefault(current, []).append(
                    f"Lesson {cells[0]} ({cells[1]}): {cells[2]}"
                )
        chapters = sorted(
            {
                int(m)
                for s in per_unit.values()
                for r in s
                for m in re.findall(r"(?:Chapter|Section)\s+(\d+)", r)
            }
        )
        return per_unit, [str(c) for c in chapters]

    def _add_textbook(self, tb: str) -> None:
        """Register the chapters linked from the online textbook page."""
        try:
            tb_html = self.fetch.text(tb)
            for r, t in self._links(html_main(tb_html), r"/resources/[^/]+/?$"):
                m = re.search(r"chapter(\d+)", r)
                if not m:
                    continue
                ch = int(m.group(1))
                sid = f"TEXTBOOK-ch{ch:02d}"
                if self.include_readings:
                    rm = self._media_links(self.fetch.text(r))
                    if rm["pdf"]:
                        self._add_pdf(
                            sid,
                            r,
                            rm["pdf"][0],
                            "textbook_chapter",
                            title=t or f"Chapter {ch}",
                            required_status="reference",
                        )
                    else:
                        self._add(
                            source_id=sid,
                            title=t,
                            url=r,
                            material_type="textbook_chapter",
                            status="missing",
                            status_detail="no PDF on resource page",
                            required_status="reference",
                        )
                else:
                    self._add(
                        source_id=sid,
                        title=t or f"Chapter {ch}",
                        url=r,
                        material_type="textbook_chapter",
                        status="skipped",
                        status_detail="textbook chapters not processed in "
                        "this run (rerun with --include-readings); "
                        "the Readings page mapping is still given to the model",
                        required_status="reference",
                    )
        except Exception as e:  # noqa: BLE001
            self.notes.append(f"online textbook page failed: {e}")

    def _add_course_pages(self, nav: list[str]) -> dict[str, str]:
        """Register the syllabus, readings and assignments pages.

        Returns the html of each page found, keyed by its source id.
        """
        page_html: dict[str, str] = {}
        for sid, pat, mtype, ttl in [
            ("COURSE-syllabus", r"^syllabus$", "syllabus", "Syllabus"),
            ("COURSE-readings", r"^readings$", "readings_index", "Readings"),
            (
                "COURSE-assignments",
                r"^assignments$",
                "assignments_index",
                "Assignments",
            ),
        ]:
            u = _nav_find(nav, pat)
            if not u:
                self._add(
                    source_id=sid,
                    title=ttl,
                    url=self.course_url,
                    material_type=mtype,
                    status="missing",
                    status_detail="no such page in course navigation",
                    required_status="reference",
                )
                continue
            try:
                html = self.fetch.text(u)
                page_html[sid] = html
                self._add_text_source(
                    sid,
                    html_to_text(html),
                    title=ttl,
                    url=u,
                    material_type=mtype,
                    locator_kind="section",
                    required_status="reference",
                )
                if mtype == "syllabus":
                    for vtt in self._media_links(html)["vtt"]:
                        self._add_vtt(
                            "COURSE-syllabus-video-vtt",
                            u,
                            vtt,
                            "syllabus_video_transcript",
                            title="Course introduction video (transcript)",
                            required_status="reference",
                        )
                if mtype == "readings_index":
                    self._readings, self._chapters = self._parse_readings(html)
            except Exception as e:  # noqa: BLE001
                self._add_failed(sid, str(e), title=ttl, url=u, material_type=mtype)
        return page_html

    # ------------------------------------------------------------------ main
    def run(self) -> SourceManifest:
        home_html = self.fetch.text(self.course_url)
        home = BeautifulSoup(home_html, "lxml")
        title = (
            (home.title.get_text(" ", strip=True).split("|")[0].strip())
            if home.title
            else self.course_id
        )
        try:
            meta = json.loads(self.fetch.text(self.course_url + "data.json"))
            title = meta.get("course_title") or title
            self._add_text_source(
                "COURSE-metadata",
                json.dumps(meta, indent=1, ensure_ascii=False),
                title="Course metadata (data.json)",
                url=self.course_url + "data.json",
                material_type="course_metadata",
                locator_kind="none",
                required_status="reference",
            )
        except Exception as e:  # noqa: BLE001
            self._add_failed(
                "COURSE-metadata",
                str(e),
                title="Course metadata (data.json)",
                url=self.course_url + "data.json",
                material_type="course_metadata",
            )
        self._add_text_source(
            "COURSE-page",
            html_to_text(home_html),
            title="Course home page",
            url=self.course_url,
            material_type="course_page",
            locator_kind="section",
            required_status="reference",
        )

        # Ordered top-level nav
        nav: list[str] = []
        for a in home.find_all(
            "a", href=re.compile(rf"/courses/{re.escape(self.course_id)}/pages/[^/]+/$")
        ):
            u = self._abs(a["href"])
            if u not in nav:
                nav.append(u)

        page_html = self._add_course_pages(nav)
        readings = getattr(self, "_readings", {})

        # Modules -> units, in navigation order
        # (week-based layout); else lecture-based layout.
        module_urls = [u for u in nav if MODULE_RE.match(_slug(u))]
        if not module_urls and not self._lecture_layout(nav, page_html):
            self.notes.append(
                "no week modules or numbered lecture resources found; no units built"
            )
        for i, murl in enumerate(module_urls):
            slug = _slug(murl)
            m = re.match(r"week-(\d+)", slug)
            role = "review" if slug.startswith("review") else "core"
            uid = f"U{int(m.group(1)):02d}" if m else "U00"
            try:
                html = self.fetch.text(murl)
            except Exception as e:  # noqa: BLE001
                self.notes.append(f"module page failed: {murl}: {e}")
                continue
            main = html_main(html)
            h = main.find(["h2", "h3"])
            utitle = h.get_text(" ", strip=True) if h else slug
            unit = Unit(unit_id=uid, title=utitle, order=i, url=murl, role=role)
            self._add_text_source(
                f"{uid}-module-page",
                html_to_text(html),
                title=f"{utitle} (module page)",
                url=murl,
                material_type="module_page",
                locator_kind="section",
                unit_id=uid,
                required_status="reference",
            )
            self._parse_module(unit, html)
            key = next(
                (
                    k
                    for k in readings
                    if k.lower().split(":")[0] == utitle.lower().split(":")[0]
                ),
                None,
            )
            unit.readings = readings.get(key, []) if key else []
            self.units.append(unit)

        # Textbook chapters (reference material).
        # Downloaded/extracted only with include_readings.
        tb = _nav_find(nav, r"^online-textbook$")
        if tb:
            self._add_textbook(tb)

        self.notes.append(
            f"downloads={self.fetch.downloads} raw_cache_hits={self.fetch.cache_hits}"
        )
        self.notes.append(
            "Videos are represented by their caption transcripts (VTT);"
            " video/audio processing is out of scope."
        )
        return SourceManifest(
            course_id=self.course_id,
            course_url=self.course_url,
            title=title,
            generated_at=datetime.now(UTC).isoformat(timespec="seconds"),
            sources=self.sources,
            units=self.units,
            notes=self.notes,
        )
