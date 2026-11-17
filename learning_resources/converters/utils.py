"""Helpers for the OpenDataLoader PDF to markdown converter."""

import base64
import gc
import itertools
import logging
import re
import statistics
import threading
from collections import Counter, OrderedDict, defaultdict
from collections.abc import Iterator
from dataclasses import asdict, dataclass, field
from io import BytesIO
from pathlib import Path
from typing import Any

import cv2
import litellm
import numpy as np
import pdf2image
import pymupdf
from django.conf import settings
from litellm import batch_completion
from PIL import Image

from learning_resources.converters.figures import (
    MAX_FIGURE_PAGE_FRACTION,
    Figure,
    box_area,
    is_box,
)

log = logging.getLogger(__name__)


def litellm_kwargs(timeout: float) -> dict[str, Any]:
    """
    Shared settings used by the converter's litellm requests (OCR and structure).
    """
    return {
        "custom_llm_provider": settings.LITELLM_CUSTOM_PROVIDER,
        "api_base": settings.LITELLM_API_BASE,
        "timeout": timeout,
        "num_retries": settings.OCR_REQUEST_NUM_RETRIES,
        "drop_params": True,
    }


def turn_on_litellm_debug() -> None:
    """Log litellm's requests at debug level (as litellm._turn_on_debug does)."""
    for name in ("LiteLLM", "LiteLLM Router", "LiteLLM Proxy"):
        logging.getLogger(name).setLevel(logging.DEBUG)


# pdfium is not thread-safe: every use in this process must hold this lock
PDFIUM_LOCK = threading.RLock()
MUPDF_LOCK = threading.Lock()

LIGATURES = str.maketrans(
    {
        "\ufb00": "ff",
        "\ufb01": "fi",
        "\ufb02": "fl",
        "\ufb03": "ffi",
        "\ufb04": "ffl",
        "\ufb05": "st",
        "\ufb06": "st",
    }
)


# --- Token usage ---------------------------------------------------------------


def _get(obj, name, default=None):
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


@dataclass
class Usage:
    requests: int = 0
    prompt_tokens: int = 0
    cached_tokens: int = 0
    completion_tokens: int = 0
    reasoning_tokens: int = 0

    def add(self, usage) -> None:
        """Add one response's usage (an OpenAI/litellm usage object or dict)."""
        if usage is None:
            return
        self.requests += 1
        self.prompt_tokens += _get(usage, "prompt_tokens", 0) or 0
        self.completion_tokens += _get(usage, "completion_tokens", 0) or 0
        prompt_details = _get(usage, "prompt_tokens_details")
        completion_details = _get(usage, "completion_tokens_details")
        self.cached_tokens += _get(prompt_details, "cached_tokens", 0) or 0
        self.reasoning_tokens += _get(completion_details, "reasoning_tokens", 0) or 0

    def merge(self, other: "Usage") -> None:
        for name, value in asdict(other).items():
            setattr(self, name, getattr(self, name) + value)

    def cost(self, model: str, *, batch: bool) -> float | None:
        """
        USD at litellm's list prices (batch prices when batch=True); None if unknown.
        """
        prices = litellm.model_cost.get(model) or litellm.model_cost.get(
            model.split("/", 1)[-1]
        )
        if not prices:
            return None
        suffix = "_batches" if batch else ""

        def price(name: str) -> float:
            return prices.get(f"{name}{suffix}") or prices.get(name) or 0.0

        uncached = self.prompt_tokens - self.cached_tokens
        cache_price = price("cache_read_input_token_cost") or price(
            "input_cost_per_token"
        )
        return (
            uncached * price("input_cost_per_token")
            + self.cached_tokens * cache_price
            + self.completion_tokens * price("output_cost_per_token")
        )

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict | None) -> "Usage":
        return cls(**(data or {}))

    def summary(self, model: str, *, batch: bool) -> str:
        cost = self.cost(model, batch=batch)
        list_cost = self.cost(model, batch=False)
        text = (
            f"{self.requests} requests · {self.prompt_tokens:,} input tokens "
            f"({self.cached_tokens:,} cached) · "
            f"{self.completion_tokens:,} output tokens "
            f"({self.reasoning_tokens:,} reasoning)"
        )
        if cost is not None:
            text += f" · ${cost:.4f}"
            if batch and list_cost:
                text += f" (${list_cost:.4f} at non-batch prices)"
        else:
            text += f" · no price data for {model}"
        return text


# --- Rejoining fragmented text -------------------------------------------------

# A fragment shares a line with another if they overlap this much vertically
# (as a fraction of the shorter one)
LINE_OVERLAP = 0.5
# Fragments further apart than this many line heights are not one line
# (e.g. two columns)
MAX_WORD_GAP = 3.0
# A gap wider than this fraction of the line height is a space
SPACE_GAP = 0.15
# A vertical gap between lines bigger than this fraction of the line height
# starts a new paragraph
PARAGRAPH_GAP = 0.5
# A line this much further right than the one before is an indented first line
INDENT = 8
# A line ending this far (fraction of the column width) before the right
# edge, with a full stop, ends its paragraph
SHORT_LINE = 0.15
# A fragment at most this tall (fraction of the line height), raised or
# lowered, is a superscript or subscript
SCRIPT_HEIGHT = 0.75
SCRIPT_TEXT = re.compile(r"^[A-Za-z0-9+\-]{1,4}$")
ENUMERATOR = re.compile(
    r"^(\(?[a-zA-Z]\)|\(?[ivx]{1,4}\)|\(?\d{1,2}[.)]|[•\-\u2013])\s"
)


@dataclass
class _Piece:
    text: str
    x0: float
    bottom: float
    x1: float
    top: float

    @property
    def height(self) -> float:
        return self.top - self.bottom


@dataclass
class _Line:
    pieces: list[_Piece] = field(default_factory=list)

    @property
    def x0(self) -> float:
        return min(p.x0 for p in self.pieces)

    @property
    def x1(self) -> float:
        return max(p.x1 for p in self.pieces)

    @property
    def top(self) -> float:
        return max(p.top for p in self.body)

    @property
    def bottom(self) -> float:
        return min(p.bottom for p in self.body)

    @property
    def height(self) -> float:
        return self.top - self.bottom

    @property
    def body(self) -> list[_Piece]:
        """The pieces at full size (not super/subscripts)."""
        tallest = max(p.height for p in self.pieces)
        full = [p for p in self.pieces if p.height > SCRIPT_HEIGHT * tallest]
        return full or self.pieces

    def text(self) -> str:
        out = ""
        previous = None
        body = self.body
        top, bottom, height = self.top, self.bottom, self.height
        for piece in sorted(self.pieces, key=lambda p: p.x0):
            text = piece.text
            # a script is set right against what it belongs to
            touching = (
                previous is not None
                and abs(piece.x0 - previous.x1) <= SPACE_GAP * height
            )
            if piece not in body and touching and SCRIPT_TEXT.match(text.strip()):
                middle = (piece.top + piece.bottom) / 2
                if middle > (top + bottom) / 2 + 0.15 * height:
                    text = f"$^{{{text.strip()}}}$"
                elif middle < (top + bottom) / 2 - 0.15 * height:
                    text = f"$_{{{text.strip()}}}$"
            if (
                previous is not None
                and out
                and not out[-1].isspace()
                and not text[:1].isspace()
                and piece.x0 - previous.x1 > SPACE_GAP * height
            ):
                out += " "
            out += text
            previous = piece
        return " ".join(out.split())


def _overlap(a: _Piece, b: _Line) -> bool:
    shared = min(a.top, b.top) - max(a.bottom, b.bottom)
    return shared >= LINE_OVERLAP * min(a.height, b.height)


def _x_overlap(a: _Piece, b: _Piece) -> bool:
    shared = min(a.x1, b.x1) - max(a.x0, b.x0)
    return shared > 0.5 * min(a.x1 - a.x0, b.x1 - b.x0)


def _lines(pieces: list[_Piece]) -> list[_Line]:
    """Fragments grouped into lines, top to bottom (PDF y grows upwards)."""
    lines: list[_Line] = []
    for piece in sorted(pieces, key=lambda p: (-p.top, p.x0)):
        for line in lines:
            nearest = min(line.pieces, key=lambda o: abs(o.x0 - piece.x0))
            if (
                _overlap(piece, line)
                and piece.x0 - nearest.x1 <= MAX_WORD_GAP * line.height
                and nearest.x0 - piece.x1 <= MAX_WORD_GAP * line.height
                # a fragment drawn over or under another can't go inside its text
                and not any(_x_overlap(piece, other) for other in line.pieces)
            ):
                line.pieces.append(piece)
                break
        else:
            lines.append(_Line([piece]))
    return sorted(lines, key=lambda line: (-line.top, line.x0))


def _paragraphs(lines: list[_Line]) -> list[str]:
    if not lines:
        return []
    right = max(line.x1 for line in lines)
    left = min(line.x0 for line in lines)
    paragraphs: list[list[_Line]] = [[lines[0]]]
    for line in lines[1:]:
        current = paragraphs[-1]
        previous = current[-1]
        text, previous_text = line.text(), previous.text()
        gap = previous.bottom - line.top
        height = max(previous.height, line.height)
        new = (
            gap > PARAGRAPH_GAP * height
            or bool(ENUMERATOR.match(text))
            # an indented first line (a hanging indent after the first line is fine)
            or (line.x0 > previous.x0 + INDENT and len(current) > 1)
            or (
                previous_text.endswith((".", "?", "!", ":"))
                and previous.x1 < right - SHORT_LINE * (right - left)
            )
        )
        if new:
            paragraphs.append([line])
        else:
            current.append(line)
    result = []
    for paragraph in paragraphs:
        text = ""
        for line in paragraph:
            piece = line.text()
            if text and not (text.endswith("-") and text[-2:-1].isalpha()):
                text += " "
            text += piece
        result.append(text)
    return result


def is_fragmented(boxes: list[list[float]]) -> bool:
    """Return whether two of the blocks sit side by side on one line."""
    pieces = [_Piece("", *b) for b in boxes if is_box(b)]
    return any(len(line.pieces) > 1 for line in _lines(pieces))


def _columns(pieces: list[_Piece]) -> list[list[_Piece]]:
    """
    Split pieces (in parser order) at vertical gutters no piece crosses and too
    wide to be a word gap; the columns come back in parser order.
    """
    if not pieces:
        return []
    height = statistics.median(p.height for p in pieces)
    columns: list[list[int]] = []
    edge = None
    for i in sorted(range(len(pieces)), key=lambda i: pieces[i].x0):
        piece = pieces[i]
        if edge is None or piece.x0 - edge > MAX_WORD_GAP * height:
            columns.append([])
        columns[-1].append(i)
        edge = piece.x1 if edge is None else max(edge, piece.x1)
    columns.sort(key=min)
    return [[pieces[i] for i in sorted(column)] for column in columns]


def reflow(blocks: list[tuple[list[float], str]]) -> list[str]:
    """
    Paragraphs of text for a run of (bbox, text) blocks; bbox is PDF points
    (x1, y1, x2, y2) with the origin bottom-left. Separate columns are reflowed
    one at a time, in parser order.
    """
    pieces = [
        _Piece(text, *b) for b, text in blocks if is_box(b) and text and text.strip()
    ]
    return [
        paragraph
        for column in _columns(pieces)
        for paragraph in _paragraphs(_lines(column))
    ]


# --- Running headers and footers -----------------------------------------------

RUNNING_PAGE = re.compile(r"(<!-- page: \d+ -->)")
# lines this close to a page's top or bottom are looked at
EDGE_LINES = 4
# a running line is on at least this share of pages, and this many
MIN_SHARE = 0.5
MIN_PAGES = 3
MAX_CHARS = 150

NOT_TEXT = re.compile(r"^\s*(<!--|!\[|</?details|</?figure|</?summary)")
STRUCTURE = re.compile(
    r"^\s*(\$\$|```|~~~|\||#{1,6}\s|[-*+]\s|\d+[.)](\s|$)|\\(tag|end|begin)\b|\\\]|\\\[)"
)
# "a)", "(iv)", "Problem 3", "Problem T2.", "Figure 2:", "Part b" (not "Problem Set 3",
# a header)
RUNNING_LABEL = re.compile(
    r"^(\(?[a-z]{1,2}\)|\(?[ivx]{1,5}\)|"
    r"(problem|question|exercise|step|task|solution|figure|fig|table|answer)s?"
    r"\.?\s*[a-z]?\d+[a-z]?\b|"
    r"part\s+[a-z\d]{1,3}\b)",
    re.I,
)
# attribution OCW requires next to third-party figures stays, repeated or not
CREDIT = re.compile(
    r"courtesy|used with permission|©|\(c\)|copyright|image by|images? (?:source|from)",
    re.I,
)
FENCE = re.compile(r"^\s*(```|~~~|\$\$)")
# display math opened and closed on one line: $$x$$, not $$ or $$$$
ONE_LINE_MATH = re.compile(r"^\$\$.+\$\$$")
# a page number has at most this many numbers ("33", "2/5", "1-3")
MAX_PAGE_NUMBER_PARTS = 2
COMMENT_OPEN = re.compile(r"<!--(?!.*-->)")


def _normalise(line: str) -> str:
    line = line.replace("\u3000", " ").replace("\xa0", " ").replace("\u2003", " ")
    line = re.sub(r"[*_`]+", "", line)
    line = re.sub(r"\s+", " ", line).strip()
    return re.sub(r"\d+", "#", line).lower()


def _text_lines(lines: list[str]) -> list[int]:
    """
    Indexes of a page's lines of prose, outside code fences, display math and comments.
    """
    found, fenced, commented = [], False, False
    for i, line in enumerate(lines):
        if commented:
            commented = "-->" not in line
            continue
        if FENCE.match(line):
            # a one-line $$...$$ opens and closes
            if not ONE_LINE_MATH.match(line.strip()):
                fenced = not fenced
            continue
        if fenced or not line.strip():
            continue
        if COMMENT_OPEN.search(line):
            commented = True
            continue
        if not NOT_TEXT.match(line):
            found.append(i)
    return found


def _candidate(line: str) -> bool:
    plain = re.sub(r"[*_`]+", "", line).strip()
    return (
        0 < len(plain) <= MAX_CHARS
        # (a lone "}" ends code split over pages)
        and re.search(r"\w", plain) is not None
        and not STRUCTURE.match(line)
        and not RUNNING_LABEL.match(plain)
        and not CREDIT.search(plain)
    )


def _increasing(numbers: list[tuple[int, ...]]) -> bool:
    """Page numbers: mostly going up, as a document's pages do."""
    pairs = list(itertools.pairwise(numbers))
    return bool(pairs) and sum(1 for a, b in pairs if b > a) >= 0.8 * len(pairs)


def _peel(lines: list[str], text: list[int], running: set[str]) -> set[int]:
    """
    Find the running lines at the top and the bottom of a page, up to the
    first that isn't one.
    """
    drop: set[int] = set()
    for order in (text[:EDGE_LINES], list(reversed(text[-EDGE_LINES:]))):
        for j in order:
            if not (_candidate(lines[j]) and _normalise(lines[j]) in running):
                break
            drop.add(j)
    return drop


def strip_running_lines(markdown: str) -> str:
    """Remove the lines repeated at the top or bottom of most pages."""
    pieces = RUNNING_PAGE.split(markdown)
    # pieces: [before the first marker, marker, page, marker, page, ...]
    pages = [(i, pieces[i].split("\n")) for i in range(2, len(pieces), 2)]
    if len(pages) < MIN_PAGES:
        return markdown
    texts = {i: _text_lines(lines) for i, lines in pages}
    seen: Counter = Counter()
    for i, lines in pages:
        edges = set(texts[i][:EDGE_LINES] + texts[i][-EDGE_LINES:])
        seen.update({_normalise(lines[j]) for j in edges if _candidate(lines[j])})
    threshold = max(MIN_PAGES, MIN_SHARE * len(pages))
    running = {key for key, count in seen.items() if count >= threshold}
    if not running:
        return markdown
    # a line of numbers only ("33", "2/5", "1-3") is a page number when it
    # counts pages, or the same text on every page ("17.202"); anything else
    # numeric (data rows) never runs
    for key in [key for key in running if not re.search(r"[a-z]", key)]:
        found = []
        for i, lines in pages:
            for j in _peel(lines, texts[i], {key}):
                found.append(re.sub(r"[*_`\s]+", " ", lines[j]).strip())
                break
        numbers = [tuple(int(n) for n in re.findall(r"\d+", text)) for text in found]
        counts_pages = key.count("#") <= MAX_PAGE_NUMBER_PARTS and _increasing(numbers)
        if len(found) < threshold or not (counts_pages or len(set(found)) == 1):
            running.discard(key)
    for i, lines in pages:
        if drop := _peel(lines, texts[i], running):
            pieces[i] = "\n".join(_without(lines, drop))
    return "".join(pieces)


def _without(lines: list[str], drop: set[int]) -> list[str]:
    """Lines without the dropped ones, and without the blank line each leaves behind."""
    kept: list[str] = []
    for j, line in enumerate(lines):
        if j in drop:
            continue
        # a blank line right after a dropped one, following another blank line
        if not line.strip() and j - 1 in drop and kept and not kept[-1].strip():
            continue
        kept.append(line)
    return kept


# --- Converter -----------------------------------------------------------------

# --- Configuration ---
MIN_IMAGE_DIMENSION = 32
MIN_IMAGE_RATIO = 12
IMAGE_BATCH_SIZE = 10
PDF_POINTS_PER_INCH = 72
UNIQUE_COLOR_THRESHOLD = 200
# Number of rendered pages kept in memory at once
PAGE_CACHE_SIZE = 4
OCR_FAILED_PLACEHOLDER = "<!-- OCR failed for this region -->"

# Private Use Area glyphs that Symbol/Wingdings fonts commonly use for list
# bullets (e.g. U+F0B7 in Word PDFs). They're harmless, so they don't count.
PRIVATE_USE_BULLETS = "\uf06c\uf06e\uf071\uf076\uf0a7\uf0a8\uf0b7\uf0d8\uf0e0\uf0fc"
# Private Use Area glyphs (e.g. old equation-editor / Symbol font pieces) and the
# replacement character carry no meaning as text, so the page needs full OCR
UNMAPPABLE_GLYPH_REGEX = re.compile(f"(?![{PRIVATE_USE_BULLETS}])[\ue000-\uf8ff\ufffd]")
# List item text that already starts with its own label, e.g. "1.", "(a)", "iv)"
# (or with the full-width full stop and parenthesis of CJK text)
LIST_LABEL_REGEX = re.compile(
    r"^\s*[(\uff08]?(\d+|[a-zA-Z]|[ivxlcdmIVXLCDM]+)([.)](\s|$)|[\uff0e\uff09])"
)
# A bullet the item's text starts with, replaced by the list's own marker
LEADING_BULLET_REGEX = re.compile(r"^\s*(?:[•◦▪‣∙·]\s*|[*-]\s+)")
# Pieces of tall brackets and braces (\u23a1 \u23a2 \u23a3 \u23a7 \u23a8 \u23a9 ...):
# equation editors build a matrix or a cases block from them, and the parser reads it as
# a column of pieces with its entries loose after it. A page with this many is math.
EQUATION_PIECES = re.compile("[\u239b-\u23b3]")
MIN_EQUATION_PIECES = 2
# A candidate this much inside a parsed table (with this much slack, in PDF
# points), whose transcription has this share of its words in the table (or
# all but one), is the table's ruling read a second time
TABLE_BOX_SHARE = 0.8
TABLE_BOX_GAP = 6
TABLE_WORD_SHARE = 0.9
TABLE_WORD = re.compile(r"[a-z0-9]+")
LATEX_COMMAND = re.compile(r"\\[a-zA-Z]+")
# a figure's transcribed paragraph of at least this many words that a text
# block crossing the figure's edge already holds is dropped as a repeat
PARSED_LINE_MIN_WORDS = 4


def plain_words(text: str) -> str:
    """Lowercase words and numbers of text, without LaTeX commands."""
    return " ".join(TABLE_WORD.findall(LATEX_COMMAND.sub(" ", text).lower()))


# Text in a font with a scrambled encoding reads as accented Latin letters and
# symbols ("ßêó†éî•∞"); real text in any script has few of these
SCRAMBLED_GLYPHS = re.compile("[\u0080-\u02ff\u2010-\u22ff]")
# ...or, through the parser, as a run of symbols: arrows, dingbats, shapes
# ("✵❦➐❆➐➓➝"), sometimes only in a page's formulas ("where ✆✖✞ is the
# observation vector"); and as C1 control characters, which no real text has.
# (Real math text stays well under this: minus signs and arrows are a few %.)
SYMBOL_GLYPHS = re.compile("[\u2190-\u2bff]")
CONTROL_GLYPHS = re.compile("[\u0080-\u009f]")
MAX_SYMBOL_SHARE = 0.1
# A text layer that places each letter on its own reads as "Y o u  l e a r n e d":
# most of its words one letter long (real pages stay under 20%, even math)
MAX_SINGLE_LETTER_SHARE = 0.5
MIN_WORDS = 40
MAX_CONTROL_SHARE = 0.02
# A block of text this long (repeated characters counted once, so a rule of
# underscores is short) with fewer letters and digits than this share is a
# font's own encoding read as punctuation or dingbats ('!"#"$%&'), not text;
# code and formulas stay above it
MIN_GARBLED_CHARS = 20
MIN_ALNUM_SHARE = 0.3
# A page whose text layer has at least this many characters, of which the
# parser kept less than this share, lost its text in parsing
MIN_LAYER_CHARS = 40
MIN_PARSED_SHARE = 0.5


MATH_FONTS = {"cmmi", "cmsy", "cmex", "msbm", "msam", "eufm", "dsrom", "wasy", "stmary"}


# U+2212 (minus sign) is how many PDFs write a minus
BASIC_MATH_SYMBOLS = re.compile(r"[+=<>≤≥≠±\-\u2212]")
# Regex for "Complex" math (Integrals, Sums, Keywords)
COMPLEX_MATH_REGEX = re.compile(
    r"([∑∏∫∂∇√∞∀∃∈⊂\u222a→⇒⇔αβγδεθλμπστφωΩΓΛΨ]"
    r"|\b(lim|sin|cos|tan|log|ln|det|mod)\b)"
)


# --- Inline math ----------------------------------------------------------------
# Inline math the math score misses, which the parsed text would flatten.

INLINE_MATH_FONT = re.compile(
    r"cmmi|cmsy|cmex|msbm|msam|eufm|eusm|rsfs|stmary|wasy|lasy|mathematicalpi"
    r"|symbol|mtextra|math",
    re.IGNORECASE,
)
INLINE_MATH_SYMBOL = re.compile(
    "[\u03b1-ωΑ-Ω∫∑∏√∂∇∞≤≥≠≈±\u00d7÷→⇒∈∉⊂⊆\u222a∩∀∃\u2032″]"
)
MIN_MATH_CHARS = 3
MIN_MATH_SYMBOLS = 3
# sub/superscript detection, as shares of the body font size
SCRIPT_SIZE = 0.85
MIN_SCRIPT_SIZE = 0.4
SCRIPT_SHIFT = 0.15
SCRIPT_GAP = 0.5


@dataclass
class PageMath:
    """Inline math counts for a page."""

    math_chars: int = 0
    symbols: int = 0
    scripts: int = 0

    @property
    def flattened(self) -> bool:
        """Whether the page has enough inline math to OCR."""
        return (
            self.math_chars >= MIN_MATH_CHARS
            or self.symbols >= MIN_MATH_SYMBOLS
            or self.scripts > 0
        )

    def __str__(self) -> str:
        """Describe the counts."""
        return (
            f"{self.math_chars} math-font characters, {self.symbols} math symbols, "
            f"{self.scripts} sub/superscripts"
        )


def page_math(page: pymupdf.Page) -> PageMath:
    """Count a page's inline math."""
    blocks = []
    sizes = Counter()
    for block in page.get_text("dict")["blocks"]:
        spans = [
            span
            for line in block.get("lines", [])
            for span in line["spans"]
            if span["text"].strip()
        ]
        if spans:
            blocks.append(spans)
            for span in spans:
                sizes[round(span["size"], 1)] += len(span["text"])
    found = PageMath()
    if not sizes:
        return found
    body = sizes.most_common(1)[0][0]
    for spans in blocks:
        for span in spans:
            text = span["text"].strip()
            if INLINE_MATH_FONT.search(span["font"]):
                found.math_chars += len(text)
            else:
                found.symbols += len(INLINE_MATH_SYMBOL.findall(text))
            if _is_script(span, spans, body):
                found.scripts += 1
    return found


def _is_script(span: dict, spans: list[dict], body: float) -> bool:
    """
    Whether a span is a sub/superscript: small, shifted from a full-size span
    right beside it, and next to math (or flagged as a superscript).
    """
    if not MIN_SCRIPT_SIZE * body <= span["size"] < SCRIPT_SIZE * body:
        return False

    def touching(other: dict) -> bool:
        a, b = span, other
        gap = max(b["bbox"][0] - a["bbox"][2], a["bbox"][0] - b["bbox"][2])
        return gap < SCRIPT_GAP * body and abs(a["origin"][1] - b["origin"][1]) < body

    neighbours = [x for x in spans if x is not span and touching(x)]
    shifted = any(
        abs(span["origin"][1] - x["origin"][1]) > SCRIPT_SHIFT * body
        for x in neighbours
        if x["size"] >= SCRIPT_SIZE * body
    )
    beside_math = any(INLINE_MATH_FONT.search(x["font"]) for x in [span, *neighbours])
    # flags bit 0: superscript
    return shifted and bool(beside_math or span["flags"] & 1)


def document_math(document_path) -> dict[int, PageMath]:
    """Map page number to its inline math."""
    with MUPDF_LOCK, pymupdf.open(document_path) as doc:
        return {n: page_math(page) for n, page in enumerate(doc, start=1)}


# --- Content Block Types (from JsonName.java) ---
class BlockType:
    IMAGE = "image"
    LIST_ITEM = "list item"
    LINE = "line"
    TABLE = "table"
    TEXT_BLOCK = "text block"
    LIST = "list"
    TABLE_CELL = "table cell"
    TABLE_ROW = "table row"
    PARAGRAPH = "paragraph"
    HEADING = "heading"
    TEXT_CHUNK = "text chunk"
    CAPTION = "caption"
    NOTE = "note"
    FULL_PAGE_OCR = "full_page_ocr"


# Block types whose text can take a list item's marker
LIST_MARKER_BLOCK_TYPES = {
    BlockType.PARAGRAPH,
    BlockType.TEXT_CHUNK,
    BlockType.TEXT_BLOCK,
    BlockType.LINE,
}


@dataclass
class TableCell:
    """Represents a cell in a table."""

    content: str | None = None
    column_number: int = 0
    row_number: int = 0
    column_span: int = 1
    row_span: int = 1
    kids: list[Any] = field(default_factory=list)


@dataclass
class TableRow:
    """Represents a row in a table."""

    row_number: int = 0
    cells: list[TableCell] = field(default_factory=list)


@dataclass
class ListItem:
    """Represents an item in a list."""

    content: str | None = None
    kids: list[Any] = field(default_factory=list)
    block_id: int = 0
    page_number: int | None = None
    bounding_box: list[float] = field(default_factory=list)
    font: str | None = None


@dataclass
class ContentBlock:
    block_type: str
    block_id: int
    page_number: int
    bounding_box: list[float]
    content: str | None = None
    heading_level: int | None = None
    font: str | None = None
    # Table-specific fields
    rows: list[TableRow] = field(default_factory=list)
    number_of_rows: int = 0
    number_of_columns: int = 0
    # List-specific fields
    list_items: list[ListItem] = field(default_factory=list)
    numbering_style: str | None = None
    # Nested content (for complex structures)
    kids: list[Any] = field(default_factory=list)
    # "1." / "-" marker of the list item this block came from. Kept apart from
    # content so it isn't scored as math.
    list_marker: str | None = None
    # For full-page OCR: the page's parsed blocks, used if the OCR request fails
    fallback_blocks: list["ContentBlock"] = field(default_factory=list)
    # For a figure candidate's IMAGE block: the figure it stands for
    figure: Figure | None = None


@dataclass
class ImageForOCR:
    block_id: int
    image_uri: str
    is_full_page: bool
    # Overrides settings.OCR_PROMPT for this image
    prompt: str | None = None

    @classmethod
    def from_pil_image(
        cls,
        block_id: int,
        pil_image: Image.Image,
        *,
        is_full_page: bool,
        prompt: str | None = None,
    ) -> "ImageForOCR":
        """Encode the image up front so the bitmap doesn't need to be kept around"""
        return cls(block_id, _image_to_base64_uri(pil_image), is_full_page, prompt)


def _image_to_base64_uri(pil_image: Image.Image) -> str:
    buffer = BytesIO()
    pil_image.save(buffer, format="JPEG", optimize=True)
    image_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/jpeg;base64,{image_b64}"


def _build_ocr_message(image_uri: str, prompt: str) -> list[dict]:
    return [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": image_uri}},
            ],
        }
    ]


def _is_valid_image_dimensions(width: int, height: int) -> bool:
    """Check if image dimensions are valid for processing."""
    if width < MIN_IMAGE_DIMENSION or height < MIN_IMAGE_DIMENSION:
        return False

    # Avoid extremely thin strips (often separator lines)
    if height > 0:
        aspect_ratio = width / height
        if aspect_ratio > MIN_IMAGE_RATIO or aspect_ratio < (1 / MIN_IMAGE_RATIO):
            return False

    return True


def optimize_image(pil_image: Image.Image) -> Image.Image:
    if pil_image.mode != "RGB":
        pil_image = pil_image.convert("RGB")
    np_image = np.array(pil_image)
    # getcolors returns None when there are more than the given number of colors
    if pil_image.getcolors(UNIQUE_COLOR_THRESHOLD) is None:
        processed = cv2.cvtColor(np_image, cv2.COLOR_RGB2GRAY)
        processed = cv2.GaussianBlur(processed, (3, 3), 0)
        return Image.fromarray(processed)
    else:
        gray = cv2.cvtColor(np_image, cv2.COLOR_RGB2GRAY)
        _, processed = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        return Image.fromarray(processed)


HEADER_FOOTER = ("header", "footer")


def _header_footer_text(block: dict) -> str:
    texts = [block.get("content") or ""]
    texts += [
        _header_footer_text(k) for k in block.get("kids") or [] if isinstance(k, dict)
    ]
    return " ".join(t.strip() for t in texts if t and t.strip())


def unwrap_header_footer(kids: list[dict]) -> list[dict]:
    """
    Keep parser header/footer blocks that are content (a problem label, a
    line on one page only, a credit); drop page numbers and running lines.
    """

    def key(block: dict) -> str:
        return re.sub(
            r"\d+", "#", re.sub(r"\s+", " ", _header_footer_text(block)).lower()
        )

    edges = [k for k in kids if isinstance(k, dict) and k.get("type") in HEADER_FOOTER]
    pages: dict[str, set] = defaultdict(set)
    for block in edges:
        pages[key(block)].add(block.get("page number"))
    flat = []
    for kid in kids:
        if not (isinstance(kid, dict) and kid.get("type") in HEADER_FOOTER):
            flat.append(kid)
            continue
        text = _header_footer_text(kid)
        if not re.search(r"[^\W\d_]", text) and not CREDIT.search(text):
            continue
        if (
            RUNNING_LABEL.match(text)
            or CREDIT.search(text)
            or len(pages[key(kid)]) == 1
        ):
            flat.extend(k for k in kid.get("kids") or [] if isinstance(k, dict))
    return flat


def parse_content_block(block_data: dict[str, Any]) -> ContentBlock:
    """
    Parse a content block from JSON data.

    Handles all content types including nested structures for tables and lists.
    """
    block_type = block_data.get("type", "unknown")

    # Parse table rows if present
    rows = []
    if block_type == BlockType.TABLE and "rows" in block_data:
        rows = _parse_table_rows(block_data["rows"])

    # Parse list items if present
    list_items = []
    if block_type == BlockType.LIST and "list items" in block_data:
        list_items = _parse_list_items(block_data["list items"])

    return ContentBlock(
        block_type=block_type,
        block_id=block_data.get("id", 0),
        page_number=block_data.get("page number", 1),
        bounding_box=block_data.get("bounding box", [0, 0, 0, 0]),
        content=block_data.get("content"),
        heading_level=block_data.get("heading level"),
        font=block_data.get("font"),
        rows=rows,
        number_of_rows=block_data.get("number of rows", 0),
        number_of_columns=block_data.get("number of columns", 0),
        list_items=list_items,
        numbering_style=block_data.get("numbering style"),
        kids=block_data.get("kids", []),
    )


def _parse_table_rows(rows_data: list[dict]) -> list[TableRow]:
    """Parse table rows from JSON data."""
    rows = []
    for row_data in rows_data:
        cells = [
            TableCell(
                content=cell_data.get("content"),
                column_number=cell_data.get("column number", 0),
                row_number=cell_data.get("row number", 0),
                column_span=cell_data.get("column span", 1),
                row_span=cell_data.get("row span", 1),
                kids=cell_data.get("kids", []),
            )
            for cell_data in row_data.get("cells", [])
        ]

        rows.append(
            TableRow(
                row_number=row_data.get("row number", 0),
                cells=cells,
            )
        )
    return rows


def _parse_list_items(items_data: list[Any]) -> list[ListItem]:
    """Parse list items from JSON data."""
    return [
        ListItem(
            content=item_data.get("content"),
            kids=item_data.get("kids", []),
            block_id=item_data.get("id", 0),
            page_number=item_data.get("page number"),
            bounding_box=item_data.get("bounding box", []),
            font=item_data.get("font"),
        )
        for item_data in items_data
        if isinstance(item_data, dict)
    ]


def _is_ordered_list(numbering_style: str | None) -> bool:
    """Determine if list should be ordered based on numbering style."""
    if not numbering_style:
        return False
    # Common ordered list indicators
    ordered_indicators = ["decimal", "number", "alpha", "roman", "1", "a", "i"]
    return any(ind in numbering_style.lower() for ind in ordered_indicators)


def flatten_lists(blocks: list[ContentBlock]) -> list[ContentBlock]:
    """
    Replace each list block with its items, each followed by the blocks nested
    under it (sub-lists, follow-on paragraphs, images), keeping their own
    page numbers and positions.
    """
    flat = []
    for block in blocks:
        if block.block_type != BlockType.LIST:
            flat.append(block)
            continue
        items = block.list_items or _parse_list_items(
            [
                kid
                for kid in block.kids
                if isinstance(kid, dict) and kid.get("type") == BlockType.LIST_ITEM
            ]
        )
        is_ordered = _is_ordered_list(block.numbering_style)
        for idx, item in enumerate(items, start=1):
            item_blocks = []
            if item.content and item.content.strip():
                item_blocks.append(
                    ContentBlock(
                        block_type=BlockType.PARAGRAPH,
                        block_id=item.block_id,
                        page_number=item.page_number or block.page_number,
                        bounding_box=item.bounding_box or block.bounding_box,
                        content=item.content.strip(),
                        font=item.font,
                    )
                )
            item_blocks.extend(
                flatten_lists(
                    [parse_content_block(k) for k in item.kids if isinstance(k, dict)]
                )
            )
            # The marker goes on the item's first text, which is in its kids
            # when the item has no content of its own
            first_text = next(
                (b for b in item_blocks if b.content and b.content.strip()), None
            )
            if (
                first_text
                and first_text.block_type in LIST_MARKER_BLOCK_TYPES
                and first_text.list_marker is None
                # The item already has its own label, don't add another
                and not LIST_LABEL_REGEX.match(first_text.content)
            ):
                first_text.list_marker = f"{idx}." if is_ordered else "-"
                first_text.content = LEADING_BULLET_REGEX.sub("", first_text.content)
            flat.extend(item_blocks)
    return flat


def _iter_nested_text(nodes: list[Any]) -> Iterator[tuple[str | None, str | None]]:
    """Yield (font, content) for raw JSON nodes and everything nested in them"""
    for node in nodes:
        if not isinstance(node, dict):
            continue
        yield node.get("font"), node.get("content")
        for key in ("kids", "list items", "rows", "cells"):
            yield from _iter_nested_text(node.get(key) or [])


def _iter_block_text(block: ContentBlock) -> Iterator[tuple[str | None, str | None]]:
    """Yield (font, content) for a block and all text nested inside it"""
    yield block.font, block.content
    for item in block.list_items:
        yield item.font, item.content
        yield from _iter_nested_text(item.kids)
    for row in block.rows:
        for cell in row.cells:
            yield None, cell.content
            yield from _iter_nested_text(cell.kids)
    yield from _iter_nested_text(block.kids)


_TEXT_BLOCKS = (
    BlockType.PARAGRAPH,
    BlockType.TEXT_CHUNK,
    BlockType.TEXT_BLOCK,
    BlockType.LINE,
)
# a text block at most this tall (PDF points) is one line of text
MAX_LINE_HEIGHT = 20


def _is_line_of_text(block: ContentBlock) -> bool:
    box = block.bounding_box
    return (
        block.block_type in _TEXT_BLOCKS
        and bool(block.content)
        and "\n" not in block.content.strip()
        and is_box(box)
        and 0 < box[3] - box[1] <= MAX_LINE_HEIGHT
    )


def iter_text(blocks: list[ContentBlock]) -> Iterator[tuple[str | None, str | None]]:
    """
    (font, content) of each block and of the blocks nested in it: lists,
    list items and tables keep their text in nested kids.
    """
    for block in blocks:
        yield from _iter_block_text(block)


def _squeeze(text: str | None) -> str:
    """Text without whitespace."""
    return "".join((text or "").split())


# --- Page strategy ----------------------------------------------------------------
# Whether a page's parsed text can stand for it, or the page is OCR'd in full.

# a page with an image this big and fewer words than this is a scan
MAX_SCANNED_PAGE_WORDS = 20
# US Letter, in PDF points
DEFAULT_PAGE_SIZE = (612, 792)


def page_math_score(blocks: list[ContentBlock]) -> int:
    """Return a score representing 'math density' for a page."""
    score = 0
    for font, content in iter_text(blocks):
        if font:
            font_base = "".join(c for c in font.lower() if c.isalpha())
            if any(mf in font_base for mf in MATH_FONTS):
                score += 1
        if content:
            text = content.strip()
            if COMPLEX_MATH_REGEX.search(text):
                score += 3
            elif BASIC_MATH_SYMBOLS.search(text):
                score += 1
    return score


def has_unmappable_text(blocks: list[ContentBlock]) -> bool:
    """
    Return whether the page's text layer contains private-use or replacement
    characters: equation-editor fonts draw tall brackets, fraction pieces and
    symbols with glyphs that map to nothing, so the parsed text is garbled.
    """
    return any(
        content and UNMAPPABLE_GLYPH_REGEX.search(content)
        for _, content in iter_text(blocks)
    )


def has_equation_pieces(blocks: list[ContentBlock]) -> bool:
    """Return whether the page's text layer has tall-bracket pieces."""
    pieces = sum(
        len(EQUATION_PIECES.findall(content or "")) for _, content in iter_text(blocks)
    )
    return pieces >= MIN_EQUATION_PIECES


def is_scanned_page(blocks: list[ContentBlock], page_size: tuple[float, float]) -> bool:
    """Return whether an image covers most of the page with little text."""
    words = sum(len((content or "").split()) for _, content in iter_text(blocks))
    if words >= MAX_SCANNED_PAGE_WORDS:
        return False
    page_area = page_size[0] * page_size[1]
    return any(
        b.block_type == BlockType.IMAGE
        and is_box(b.bounding_box)
        and box_area(b.bounding_box) > MAX_FIGURE_PAGE_FRACTION * page_area
        for b in blocks
    )


def text_lost_reason(
    layer_text: str, blocks: list[ContentBlock], *, has_content: bool
) -> str | None:
    """
    Why the parsed text can't stand for the page, if it can't (nothing
    parsed, little of the text layer kept, scrambled or letter-spaced text).
    layer_text is the page's text layer as the PDF has it.
    """
    if not blocks and has_content:
        return "Nothing parsed on the page"
    contents = [content for _, content in iter_text(blocks)]
    return _layer_lost(_squeeze(layer_text), contents) or _parsed_garbled(contents)


def _layer_lost(layer: str, contents: list[str | None]) -> str | None:
    """Why the text layer (without whitespace) isn't in the parsed text, if not."""
    if len(layer) < MIN_LAYER_CHARS:
        return None
    parsed = sum(len(_squeeze(c)) for c in contents)
    if parsed < MIN_PARSED_SHARE * len(layer):
        return f"Parser kept {parsed} of {len(layer)} text-layer characters"
    if len(SCRAMBLED_GLYPHS.findall(layer)) > 0.3 * len(layer):
        return "Scrambled text layer"
    if len(CONTROL_GLYPHS.findall(layer)) > MAX_CONTROL_SHARE * len(layer):
        return "Control characters in the text layer"
    return None


def _parsed_garbled(contents: list[str | None]) -> str | None:
    """Why the parsed text isn't real text, if it isn't."""
    text = "".join(_squeeze(c) for c in contents)
    if len(text) >= MIN_LAYER_CHARS and len(
        SYMBOL_GLYPHS.findall(text)
    ) > MAX_SYMBOL_SHARE * len(text):
        return "Parsed text is mostly symbols"
    for content in contents:
        chars = re.sub(r"(.)\1+", r"\1", _squeeze(content))
        alnum = sum(ch.isalnum() for ch in chars)
        if len(chars) >= MIN_GARBLED_CHARS and alnum < MIN_ALNUM_SHARE * len(chars):
            return "Garbled text in the text layer"
    words = [w for c in contents for w in (c or "").split()]
    single = sum(1 for w in words if len(w) == 1 and w.isalpha())
    if len(words) >= MIN_WORDS and single > MAX_SINGLE_LETTER_SHARE * len(words):
        return "Letter-spaced text"
    return None


# --- Rendering, OCR and assembly ----------------------------------------------


class PDFPageRenderer:
    def __init__(self, document_path: Path, dpi: int = 150):
        self.document_path = document_path
        self.dpi = dpi
        self._page_cache: OrderedDict[int, Image.Image] = OrderedDict()
        self.scale = dpi / PDF_POINTS_PER_INCH

    def _get_cached_page(self, page_number: int) -> Image.Image:
        """
        Render a page, keeping only the most recently used pages in memory
        """
        if page_number in self._page_cache:
            self._page_cache.move_to_end(page_number)
            return self._page_cache[page_number]
        images = pdf2image.convert_from_path(
            self.document_path,
            dpi=self.dpi,
            first_page=page_number,
            last_page=page_number,
        )
        self._page_cache[page_number] = images[0]
        while len(self._page_cache) > PAGE_CACHE_SIZE:
            _, evicted = self._page_cache.popitem(last=False)
            evicted.close()
        return images[0]

    def get_page_image(self, page_number: int) -> Image.Image:
        """
        Get a specific page from the pdf as an image
        """
        return self._get_cached_page(page_number).copy()

    def extract_region(self, page_number: int, bbox: list[float]) -> Image.Image | None:
        """
        Clip a specific region on a page as an image
        """
        page_image = self._get_cached_page(page_number)
        page_width, page_height = page_image.size

        pdf_x1, pdf_y1, pdf_x2, pdf_y2 = bbox
        pil_x1 = int(pdf_x1 * self.scale)
        pil_x2 = int(pdf_x2 * self.scale)
        pil_y1 = int(page_height - (pdf_y2 * self.scale))
        pil_y2 = int(page_height - (pdf_y1 * self.scale))

        # Clamp
        left, right = min(pil_x1, pil_x2), max(pil_x1, pil_x2)
        upper, lower = min(pil_y1, pil_y2), max(pil_y1, pil_y2)

        left = max(0, min(left, page_width))
        right = max(0, min(right, page_width))
        upper = max(0, min(upper, page_height))
        lower = max(0, min(lower, page_height))

        width = right - left
        height = lower - upper

        # validate dimensions before cropping
        if not _is_valid_image_dimensions(width, height):
            log.debug("Skipping image with invalid dimensions: %dx%d", width, height)
            return None

        return page_image.crop((left, upper, right, lower))

    def cleanup(self) -> None:
        """
        Clean up processed images
        """
        for page_image in self._page_cache.values():
            page_image.close()
        self._page_cache.clear()


class OCRProcessor:
    def __init__(self, batch_size: int = IMAGE_BATCH_SIZE):
        self.batch_size = batch_size
        self.usage = Usage()

    def process_images(self, images: list[ImageForOCR]) -> dict[int, str | None]:
        """
        Batch OCR images. A failed request's result is None.
        """
        if not images:
            return {}
        block_ids = [img.block_id for img in images]
        messages = self._prepare_messages(images)
        ocr_texts = self._execute_batch_ocr(messages)
        return dict(zip(block_ids, ocr_texts, strict=True))

    def _prepare_messages(self, images: list[ImageForOCR]) -> list[list[dict]]:
        return [
            _build_ocr_message(img.image_uri, img.prompt or settings.OCR_PROMPT)
            for img in images
        ]

    def _completion_kwargs(self) -> dict[str, Any]:
        return {
            "model": settings.OCR_MODEL,
            **litellm_kwargs(settings.OCR_REQUEST_TIMEOUT),
        }

    def _execute_batch_ocr(self, messages_list: list[list[dict]]) -> list[str | None]:
        all_texts = []
        for i in range(0, len(messages_list), self.batch_size):
            batch = messages_list[i : i + self.batch_size]
            responses = batch_completion(messages=batch, **self._completion_kwargs())
            all_texts.extend(self._response_text(resp) for resp in responses)
            gc.collect()
        return all_texts

    def _response_text(self, response: Any) -> str | None:
        """
        Get the text of an OCR response, or None if the request failed.
        batch_completion returns the exception in place of a response for a
        request that failed after num_retries, so it isn't retried again here.
        """
        if isinstance(response, Exception):
            log.warning("OCR request failed: %s", response)
            return None
        self.usage.add(getattr(response, "usage", None))
        return response.choices[0].message.content or ""


class MarkdownAssembler:
    """
    Assemble markdown from parsed OpenDataLoader blocks; each page starts with
    a <!-- page: N --> marker.
    """

    def assemble(
        self, blocks: list[ContentBlock], ocr_results: dict[int, str | None]
    ) -> str:
        formatted_parts = []
        current_page = None
        run: list[ContentBlock] = []  # consecutive single-line text blocks

        def flush():
            if run:
                formatted_parts.extend(self._format_text_run(run))
                run.clear()

        for block in flatten_lists(blocks):
            if block.page_number != current_page:
                flush()
                current_page = block.page_number
                formatted_parts.append(f"<!-- page: {current_page} -->")

            # Full Page OCR overrides all individual blocks on that page
            if block.block_type == BlockType.FULL_PAGE_OCR:
                flush()
                page_text = ocr_results.get(block.block_id, "")
                if page_text is not None:
                    formatted_parts.append(page_text)
                    continue
                # OCR failed, so use the page's parsed text instead
                log.warning(
                    "Page %d: full-page OCR failed, using parsed text",
                    block.page_number,
                )
                formatted_parts.extend(
                    filter(
                        None,
                        (
                            self._format_block(b, ocr_results)
                            for b in block.fallback_blocks
                        ),
                    )
                )
                continue

            # (a list item's marker would be lost in a rejoined run)
            if _is_line_of_text(block) and not block.list_marker:
                run.append(block)
                continue
            flush()

            # Standard formatting
            text = self._format_block(block, ocr_results)
            if text:
                formatted_parts.append(text)
            # a figure candidate whose OCR failed: the parsed text inside it
            if block.block_type == BlockType.IMAGE:
                formatted_parts.extend(
                    filter(
                        None,
                        (
                            self._format_block(b, ocr_results)
                            for b in block.fallback_blocks
                        ),
                    )
                )
        flush()
        return "\n\n".join(formatted_parts).translate(LIGATURES)

    def _format_text_run(self, run: list[ContentBlock]) -> list[str]:
        """
        Text blocks one line tall; rejoined (reflow.py) when they are fragments of
        lines.
        """
        if len(run) > 1 and is_fragmented([b.bounding_box for b in run]):
            return reflow([(b.bounding_box, b.content or "") for b in run])
        return [b.content for b in run if b.content]

    def _format_block(
        self, block: ContentBlock, ocr_results: dict[int, str | None]
    ) -> str | None:
        """
        Format one content block (heading, paragraph, image, table, text or list
        item) as markdown.
        """
        block_type = block.block_type
        block_content = None
        # Heading
        if block_type == BlockType.HEADING and block.content:
            level = min(block.heading_level or 1, 6)
            block_content = f"{'#' * level} {block.content}"

        # Paragraph
        if block_type == BlockType.PARAGRAPH and block.content:
            block_content = block.content

        # Image - use OCR result
        if block_type == BlockType.IMAGE:
            block_content = self._format_image(block, ocr_results)

        # Table
        if block_type == BlockType.TABLE:
            block_content = self._format_table(block)

        # Text chunk / text block / line, and captions and notes (the parser
        # also tags whole paragraphs next to a figure as its caption) - plain text
        if block_type in (
            BlockType.TEXT_CHUNK,
            BlockType.TEXT_BLOCK,
            BlockType.LINE,
            BlockType.CAPTION,
            BlockType.NOTE,
        ):
            block_content = block.content if block.content else None

        # Standalone list item
        if block_type == BlockType.LIST_ITEM and block.content:
            block_content = f"- {block.content}"

        # Table cell (standalone, unusual but possible)
        if block_type == BlockType.TABLE_CELL and block.content:
            block_content = block.content

        # Table row (standalone, unusual but possible)
        if block_type == BlockType.TABLE_ROW:
            block_content = self._format_table_row_standalone(block)

        if block_content and block.list_marker:
            block_content = f"{block.list_marker} {block_content}"

        return block_content

    def _format_image(
        self, block: ContentBlock, ocr_results: dict[int, str | None]
    ) -> str | None:
        """Format an image's OCR result. A result of None means OCR failed."""
        if block.block_id not in ocr_results:
            return None
        text = ocr_results[block.block_id]
        return OCR_FAILED_PLACEHOLDER if text is None else text

    def _format_table(self, block: ContentBlock) -> str | None:
        """
        Format a table block to markdown table syntax.
        """
        if not block.rows:
            # Try to extract table from nested kids structure
            return self._format_table_from_kids(block)

        num_cols = block.number_of_columns or self._detect_column_count(block.rows)
        rows = [
            [self._get_cell_content(cell) for cell in row.cells] for row in block.rows
        ]
        return self._table_markdown(rows, num_cols)

    def _format_table_from_kids(self, block: ContentBlock) -> str | None:
        """
        Format table when structure is in 'kids' field rather than 'rows'.
        """
        if not block.kids:
            return None

        rows = []
        for kid in block.kids:
            if isinstance(kid, dict) and kid.get("type") == BlockType.TABLE_ROW:
                cells_content = []
                for cell_data in kid.get("cells", []):
                    if isinstance(cell_data, dict):
                        cell_text = cell_data.get("content") or ""
                        # Handle nested kids in cell
                        if not cell_text and "kids" in cell_data:
                            cell_text = self._extract_text_from_kids(cell_data["kids"])
                    else:
                        cell_text = str(cell_data) if cell_data else ""
                    cells_content.append(cell_text)
                rows.append(cells_content)
        return self._table_markdown(rows, block.number_of_columns or 0)

    def _table_markdown(self, rows: list[list[str]], num_cols: int) -> str | None:
        """
        Rows of cell texts as a markdown table. Columns empty in every row are
        dropped (a layout table's indent column); what is left of a one-column
        table is just text, written as such.
        """
        num_cols = max([num_cols, *(len(r) for r in rows)], default=0)
        rows = [
            [(c or "").strip() for c in r] + [""] * (num_cols - len(r)) for r in rows
        ]
        keep = [i for i in range(num_cols) if any(r[i] for r in rows)]
        if not keep:
            return None
        if len(keep) == 1:
            return "\n\n".join(r[keep[0]] for r in rows if r[keep[0]])
        lines = []
        for row_idx, row in enumerate(rows):
            # Replace newlines with HTML breaks for table cells
            lines.append(
                "| " + " | ".join(row[i].replace("\n", "<br>") for i in keep) + " |"
            )
            # Add header separator after first row
            if row_idx == 0:
                lines.append("| " + " | ".join(["---"] * len(keep)) + " |")
        return "\n".join(lines)

    def _format_table_row_standalone(self, block: ContentBlock) -> str | None:
        """Format a standalone table row (unusual case)."""
        if not hasattr(block, "kids") or not block.kids:
            return block.content

        cells_content = []
        for cell in block.kids:
            if isinstance(cell, dict):
                cell_text = cell.get("content", "")
            else:
                cell_text = str(cell) if cell else ""
            cells_content.append(cell_text.replace("\n", "<br>") if cell_text else "")

        return "| " + " | ".join(cells_content) + " |" if cells_content else None

    def _get_cell_content(self, cell: TableCell) -> str:
        """Extract text content from a table cell."""
        if cell.content:
            return cell.content

        # Check nested kids for content
        if cell.kids:
            return self._extract_text_from_kids(cell.kids)

        return ""

    def _extract_text_from_kids(self, kids: list[Any]) -> str:
        """Recursively extract text from nested kids structure."""
        texts = []
        for kid in kids:
            if isinstance(kid, dict):
                if kid.get("content"):
                    texts.append(kid["content"])
                # a nested list keeps its items, a nested table its rows and
                # cells, outside "kids"
                texts.extend(
                    self._extract_text_from_kids(kid[key])
                    for key in ("kids", "list items", "rows", "cells")
                    if kid.get(key)
                )
            elif isinstance(kid, str):
                texts.append(kid)
        return "\n".join(t.strip() for t in texts if t and t.strip())

    def _detect_column_count(self, rows: list[TableRow]) -> int:
        """Detect number of columns from rows."""
        if not rows:
            return 0
        return max(len(row.cells) for row in rows)
