"""
Figures for the OpenDataLoader PDF to markdown converter: the Figure model and
how figures are written in the markdown, finding candidate figures on a page,
the figure prompts and parsing their OCR output, and where graphics are saved.
"""

import ctypes
import re
from dataclasses import asdict, dataclass
from pathlib import Path

import cv2
import numpy as np
import pypdfium2 as pdfium
import pypdfium2.raw as pdfium_c
from PIL import Image

# --- Figures -------------------------------------------------------------------

# Images closer than this (in PDF points) are treated as one figure
FIGURE_MERGE_GAP = 8
FIGURE_PADDING = 4
# A region covering most of the page is a scan of the page, not a figure
MAX_FIGURE_PAGE_FRACTION = 0.8
# Smaller regions (PDF points) are never candidates
MIN_FIGURE_SIDE = 16
# Vector paths within this many points of each other belong to one drawing
DRAWING_MERGE_DISTANCE = 10
# A drawing must be at least this many points wide and tall
MIN_DRAWING_SIZE = 36
# Text blocks of at most this many words near a figure are its labels
MAX_LABEL_WORDS = 6
LABEL_DISTANCE = 12
# Candidates side by side (sharing this fraction of the shorter one's height)
# and at most this far apart (fraction of the page width) are one layout
SIDE_BY_SIDE_OVERLAP = 0.5
SIDE_BY_SIDE_GAP = 0.15
# a bounding box is (x1, y1, x2, y2)
BOX_LENGTH = 4

GRAPHIC, TRANSCRIBED, UNDECIDED = "graphic", "transcribed", "undecided"
# a candidate whose crop shows nothing (an invisible or white object, a flat
# fill): dropped
BLANK = "blank"
# shown as its crop, with the transcription kept beside it
REGION = "region"
# a region that is text with drawings inside (parse_region_ocr only)
MIXED = "mixed"
FROM_PDF, FROM_OCR = "pdf", "ocr"


@dataclass
class Figure:
    """
    A candidate region and, once decided, a graphic to show or transcribed content.
    """

    figure_id: str
    page_number: int
    # PDF points, PDF convention: (x1, y1, x2, y2) with the origin bottom-left
    bounding_box: list[float]
    path: object = None  # Path of the saved crop, for graphics
    page_width: float = 0
    page_height: float = 0
    kind: str = UNDECIDED
    source: str = FROM_PDF
    description: str = ""
    # several items printed side by side (merge_side_by_side)
    side_by_side: bool = False

    @property
    def bbox(self) -> list[float]:
        """(x0, y0, x1, y1) in PDF points with the origin at the page's top-left."""
        x1, y1, x2, y2 = self.bounding_box
        return [
            round(v, 1) for v in (x1, self.page_height - y2, x2, self.page_height - y1)
        ]

    @property
    def page_size(self) -> list[float]:
        return [round(self.page_width, 1), round(self.page_height, 1)]

    def location(self) -> str:
        bbox = ",".join(f"{v:.1f}" for v in self.bbox)
        size = ",".join(f"{v:.1f}" for v in self.page_size)
        return f"page={self.page_number} bbox=[{bbox}] page_size=[{size}]"

    def placeholder(self) -> str:
        """
        Comment marking a graphic, for text-only output:
        <!-- figure id=p2_1 page=2 bbox=[...] page_size=[...] description="..." -->
        """
        description = _one_line(self.description).replace('"', "'")
        description = description.replace("--", "\u2013")  # not allowed in a comment
        return (
            f"<!-- figure id={self.figure_id} {self.location()} "
            f'description="{description}" -->'
        )

    def image_markdown(self, link: str) -> str:
        """
        Markdown image for display; the title keeps the id and location:
        ![description](link "p2_1 page=2 bbox=[...] page_size=[...]")
        """
        alt = _one_line(self.description).replace("[", "(").replace("]", ")")
        return f'![{alt}]({link} "{self.figure_id} {self.location()}")'

    def region_markdown(self, figure_text: str, transcription: str) -> str:
        """
        Write a region: its crop (figure_text), then its transcription collapsed in a
        <details> block, between <!-- region id --> and <!-- /region --> comments.
        """
        return (
            f"<!-- region {self.figure_id} -->\n{figure_text}\n\n"
            f"<details><summary>Transcription</summary>\n\n{transcription.strip()}\n\n"
            "</details>\n<!-- /region -->"
        )

    def to_dict(self) -> dict:
        data = asdict(self)
        data["path"] = str(self.path) if self.path else None
        return data


def _one_line(text: str) -> str:
    return " ".join((text or "").split())


FIGURE_PLACEHOLDER = re.compile(
    r"<!-- figure id=(?P<id>\S+) page=(?P<page>\d+) "
    r"bbox=\[(?P<bbox>[^\]]*)\] page_size=\[(?P<page_size>[^\]]*)\] "
    r'description="(?P<description>[^"]*)" -->'
)
FIGURE_IMAGE = re.compile(
    r"!\[(?P<description>[^\]]*)\]\((?P<link>[^\s)]+)\s+\""
    r"(?P<id>p\d+_\d+) page=(?P<page>\d+) bbox=\[(?P<bbox>[^\]]*)\] "
    r"page_size=\[(?P<page_size>[^\]]*)\]\"\)"
)


# a region as region_markdown writes it
REGION_BLOCK = re.compile(
    r"<!-- region (?P<id>p\d+_\d+) -->\s*(?P<figure>.*?)\s*"
    r"<details><summary>Transcription</summary>\s*(?P<transcription>.*?)\s*"
    r"</details>\s*<!-- /region -->",
    re.DOTALL,
)


def parse_figures(markdown: str) -> list[dict]:
    """Figures (images or placeholders) in converted markdown, in document order."""
    found = [(m.start(), m) for m in FIGURE_PLACEHOLDER.finditer(markdown)] + [
        (m.start(), m) for m in FIGURE_IMAGE.finditer(markdown)
    ]
    regions = {m["id"] for m in REGION_BLOCK.finditer(markdown)}
    return [
        {
            "id": m["id"],
            "kind": REGION if m["id"] in regions else GRAPHIC,
            "page": int(m["page"]),
            "bbox": [float(v) for v in m["bbox"].split(",")],
            "page_size": [float(v) for v in m["page_size"].split(",")],
            "description": m["description"],
            "link": m.groupdict().get("link"),
        }
        for _, m in sorted(found, key=lambda pair: pair[0])
    ]


# --- Finding candidates -------------------------------------------------------


def is_box(box) -> bool:
    """Return whether box is a bounding box (x1, y1, x2, y2)."""
    return len(box) == BOX_LENGTH


def union(a: list[float], b: list[float]) -> list[float]:
    """Return the smallest box holding boxes a and b."""
    return [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])]


def box_area(box: list[float]) -> float:
    """Return the area of a box."""
    return (box[2] - box[0]) * (box[3] - box[1])


def display_box(
    box: list[float], rotation: int, width: float, height: float
) -> list[float]:
    """
    Turn a box in the page's own (unrotated) space onto the page as shown,
    turned `rotation` degrees clockwise (the page's /Rotate). width and height
    are the page's size as shown. Both spaces have a bottom-left origin.
    """
    x1, y1, x2, y2 = box
    match rotation:
        case 90:
            # the unrotated page is height wide and width tall
            return [y1, height - x2, y2, height - x1]
        case 180:
            return [width - x2, height - y2, width - x1, height - y1]
        case 270:
            return [width - y2, x1, width - y1, x2]
    return list(box)


def boxes_near(a: list[float], b: list[float], gap: float) -> bool:
    """Return whether boxes a and b overlap or are at most gap apart."""
    return (
        a[0] - gap <= b[2]
        and b[0] - gap <= a[2]
        and a[1] - gap <= b[3]
        and b[1] - gap <= a[3]
    )


def share_inside(a: list[float], b: list[float], gap: float = 0) -> float:
    """Return the share of box a's area inside box b (grown by gap on each side)."""
    width = min(a[2], b[2] + gap) - max(a[0], b[0] - gap)
    height = min(a[3], b[3] + gap) - max(a[1], b[1] - gap)
    area = (a[2] - a[0]) * (a[3] - a[1])
    return max(width, 0) * max(height, 0) / area if area > 0 else 0.0


def merge_boxes(boxes: list[list[float]], gap: float = FIGURE_MERGE_GAP) -> list:
    """
    Union bounding boxes (x1, y1, x2, y2) that overlap or nearly touch, until
    no two of the results do. A sweep over x with union-find per pass, so a
    page of thousands of vector paths stays fast.
    """
    merged = [list(b) for b in boxes]
    while len(merged) > 1:
        parent = list(range(len(merged)))
        active: list[int] = []
        for i in sorted(range(len(merged)), key=lambda k: merged[k][0]):
            box = merged[i]
            active = [j for j in active if merged[j][2] + gap >= box[0]]
            for j in active:
                if boxes_near(box, merged[j], gap):
                    parent[_find(parent, i)] = _find(parent, j)
            active.append(i)

        groups: dict[int, list[float]] = {}
        for i, box in enumerate(merged):
            root = _find(parent, i)
            groups[root] = union(groups[root], box) if root in groups else list(box)
        if len(groups) == len(merged):
            break
        merged = list(groups.values())
    return merged


def _find(parent: list[int], i: int) -> int:
    """Union-find root of i, compressing the path on the way."""
    while parent[i] != i:
        parent[i] = parent[parent[i]]
        i = parent[i]
    return i


def merge_side_by_side(
    boxes: list[list[float]], gap: float
) -> list[tuple[list[float], bool]]:
    """
    Union candidates side by side on the same rows (e.g. two plots), so they
    are cropped and decided as one. Returns (box, merged) pairs.
    """
    items = [(list(b), False) for b in boxes]
    merged = True
    while merged:
        merged = False
        for i, (a, _) in enumerate(items):
            for j in range(i + 1, len(items)):
                b = items[j][0]
                shared = min(a[3], b[3]) - max(a[1], b[1])
                apart = max(a[0], b[0]) - min(a[2], b[2])
                if (
                    shared >= SIDE_BY_SIDE_OVERLAP * min(a[3] - a[1], b[3] - b[1])
                    and apart <= gap
                ):
                    items[i] = (union(a, b), True)
                    del items[j]
                    merged = True
                    break
            if merged:
                break
    return items


# A path of separate rules is split into its lines only when its box holds this many
# words: heading underlines around paragraphs, not the strokes of a sparse diagram
MIN_SPLIT_WORDS = 30
# ...and is at least two rules (each a move and a line segment), each rule two
# points at most this far (PDF points) from level
MIN_RULES = 2
MIN_RULE_SEGMENTS = 2 * MIN_RULES
POINTS_PER_RULE = 2
MAX_RULE_SLOPE = 1


def _words_inside(page, bounds) -> int:
    left, bottom, right, top = bounds
    textpage = page.get_textpage()
    try:
        return len(textpage.get_text_bounded(left, bottom, right, top).split())
    finally:
        textpage.close()


def _line_pieces(obj) -> list[list[float]] | None:
    """
    Boxes of a path that is only separate horizontal unfilled lines (rules,
    underlines), one per line; None for any other path.
    """
    raw = obj.raw
    fill, stroke = ctypes.c_int(), ctypes.c_int()
    count = pdfium_c.FPDFPath_CountSegments(raw)
    if (
        count < MIN_RULE_SEGMENTS
        or not pdfium_c.FPDFPath_GetDrawMode(
            raw, ctypes.byref(fill), ctypes.byref(stroke)
        )
        or fill.value
    ):
        return None
    matrix = obj.get_matrix()
    lines, current = [], []
    x, y = ctypes.c_float(), ctypes.c_float()
    for i in range(count):
        segment = pdfium_c.FPDFPath_GetPathSegment(raw, i)
        kind = pdfium_c.FPDFPathSegment_GetType(segment)
        if kind == pdfium_c.FPDF_SEGMENT_BEZIERTO or pdfium_c.FPDFPathSegment_GetClose(
            segment
        ):
            return None
        pdfium_c.FPDFPathSegment_GetPoint(segment, ctypes.byref(x), ctypes.byref(y))
        point = matrix.on_point(x.value, y.value)
        if kind == pdfium_c.FPDF_SEGMENT_MOVETO:
            current = [point]
            lines.append(current)
        else:
            current.append(point)
    if len(lines) < MIN_RULES or any(
        len(line) != POINTS_PER_RULE or abs(line[0][1] - line[1][1]) > MAX_RULE_SLOPE
        for line in lines
    ):
        return None
    return [
        [min(a[0], b[0]), min(a[1], b[1]), max(a[0], b[0]), max(a[1], b[1])]
        for a, b in lines
    ]


def find_figure_boxes(
    page: pdfium.PdfPage, text_blocks: list[tuple[list[float], str]]
) -> list[tuple[list[float], bool]]:
    """
    Candidate figure boxes on one page (display_box coordinates), top to bottom,
    each with whether it is several items side by side. Candidates are images,
    form XObjects and vector-path clusters too big to be rules; short text
    blocks touching one (its labels) are folded in.
    """
    width, height = page.get_width(), page.get_height()
    rotation = page.get_rotation()
    area = width * height
    images, paths = [], []
    for obj in page.get_objects(max_depth=0):
        bounds = display_box(list(obj.get_bounds()), rotation, width, height)
        if obj.type in (pdfium_c.FPDF_PAGEOBJ_IMAGE, pdfium_c.FPDF_PAGEOBJ_FORM):
            images.append(bounds)
        elif (
            obj.type == pdfium_c.FPDF_PAGEOBJ_PATH
            and (pieces := _line_pieces(obj))
            and _words_inside(page, obj.get_bounds()) >= MIN_SPLIT_WORDS
        ):
            # (rules: too thin to be a figure unless other paths join them)
            paths += [
                display_box(piece, rotation, width, height)
                for piece in pieces
                if box_area(piece) <= MAX_FIGURE_PAGE_FRACTION * area
            ]
        # a page background or frame would merge every figure into one
        # page-sized box, which is then dropped
        elif (
            obj.type == pdfium_c.FPDF_PAGEOBJ_PATH
            and box_area(bounds) <= MAX_FIGURE_PAGE_FRACTION * area
        ):
            paths.append(bounds)

    drawings = [
        b
        for b in merge_boxes(paths, DRAWING_MERGE_DISTANCE)
        if b[2] - b[0] >= MIN_DRAWING_SIZE and b[3] - b[1] >= MIN_DRAWING_SIZE
    ]
    boxes = [
        b
        for b in merge_boxes(images + drawings)
        if b[2] - b[0] >= MIN_FIGURE_SIDE and b[3] - b[1] >= MIN_FIGURE_SIDE
    ]

    labels = [
        bbox
        for bbox, text in text_blocks
        if is_box(bbox) and text and len(text.split()) <= MAX_LABEL_WORDS
    ]
    for _ in range(3):
        boxes = merge_boxes([_with_labels(box, labels) for box in boxes])

    items = merge_side_by_side(boxes, SIDE_BY_SIDE_GAP * width)
    items = [(b, s) for b, s in items if box_area(b) <= MAX_FIGURE_PAGE_FRACTION * area]
    # PDF y grows upwards, so the highest y2 is the top of the page
    return sorted(items, key=lambda item: (-item[0][3], item[0][0]))


def _with_labels(box: list[float], labels: list[list[float]]) -> list[float]:
    """Grow a box over each label touching it (or what it has grown into)."""
    for label in labels:
        if boxes_near(box, label, LABEL_DISTANCE):
            box = union(box, label)
    return box


# --- Prompts and parsing the OCR output --------------------------------------

PAGE_FIGURES_PROMPT = """

Graphics on this page. {candidates}
- Where a graphic (a photo, diagram, plot, chart or drawing that markdown cannot \
represent) appears in the reading order, output `<!-- figure: <id> | <one-sentence \
description> -->` instead of transcribing or describing it in any other way. Labels \
drawn inside a drawing (axis labels, callouts, labelled parts) go only in its \
description.
- A listed region that is really text, a formula or a table (e.g. an equation \
embedded as a picture): transcribe it as markdown where it appears and output no \
figure comment for it.
- A listed region that mixes drawings with sentences, formulas or tables (e.g. a \
boxed problem statement with a diagram, or a chart of diagrams with their equations): \
transcribe its sentences, formulas and tables as markdown where they appear, and \
output each drawing inside it as a `new` graphic (below) with its own position. Mark \
the listed id as text.
- A graphic that is not listed: output `<!-- figure: new | <one-sentence description> \
| <x0>,<y0>,<x1>,<y1> -->` where it appears, with its approximate position as \
fractions of the page width (x) and height (y) from the top-left.
- A part of the page that is mostly text but whose meaning depends on how it is laid \
out, so that markdown would not look like the page (a diagram or flowchart made of \
labelled boxes and arrows, two or more tables or panels printed side by side, a figure \
built from text). Never merge, split or rearrange such tables to make them fit \
markdown: transcribe it as usual, but wrap the transcription in `<!-- region: <id> | \
<one-sentence description> -->` ... `<!-- /region -->`, where <id> is the listed id \
when the part is exactly a listed region; otherwise write `new` and add its \
approximate position: `<!-- region: new | <one-sentence description> | \
<x0>,<y0>,<x1>,<y1> -->`. Ordinary paragraphs, lists, equations and single tables are \
never regions.
{regions}"""

REGION_PROMPT = (
    "This image is a region cropped from a document page. Formulas are LaTeX ($...$ "
    "inline, $$...$$ display). Labels drawn inside a drawing (axis labels, callouts, "
    "labelled parts) belong to that drawing.\n"
    "- Only a graphic (a photo, diagram, plot, chart or drawing that markdown cannot "
    "represent): output ONLY `<!-- figure: <one-sentence description> -->`.\n"
    "- Only text, formulas, a table or code: transcribe it to markdown.\n"
    "- Mostly text, but laid out in a way markdown cannot show (a diagram or flowchart "
    "of labelled boxes and arrows, tables or panels side by side): output "
    "`<!-- region: <one-sentence description> -->` and then the transcription.\n"
    "- Both, e.g. a boxed problem statement with a diagram, or diagrams next to their "
    "equations: transcribe the sentences, formulas and tables in reading order, "
    "and where "
    "each drawing sits output `<!-- figure: <one-sentence description> | "
    "<x0>,<y0>,<x1>,<y1> -->` with the drawing's position as fractions of this image's "
    "width (x) and height (y) from its top-left.\n"
    "Do not include extra commentary - ONLY output the comment(s) and transcribed "
    "markdown."
)


def page_prompt(base_prompt: str, figures: list[Figure]) -> str:
    """Build the full-page OCR prompt, told about the page's candidate regions."""
    if figures:
        lines = []
        for f in figures:
            x0, y0, x1, y1 = f.bbox
            w, h = f.page_width or 1, f.page_height or 1
            line = (
                f"- {f.figure_id}: x {x0 / w:.2f}-{x1 / w:.2f}, "
                f"y {y0 / h:.2f}-{y1 / h:.2f}"
            )
            if f.side_by_side:
                line += (
                    " (several items printed side by side: unless it is one graphic, "
                    "it is a region)"
                )
            lines.append(line)
        candidates = (
            "These regions were found in the PDF, top to bottom, with their position "
            "as fractions of the page width (x) and height (y) from the top-left:\n"
            + "\n".join(lines)
        )
        regions = (
            "- End with one line "
            "`<!-- regions: <id>=graphic|text|region, ... -->` that "
            "covers every listed id."
        )
    else:
        candidates = "No graphics were found in the PDF's structure for this page."
        regions = ""
    return base_prompt + PAGE_FIGURES_PROMPT.format(
        candidates=candidates, regions=regions
    )


# a graphic in the page OCR: "<id> | <description> | <box>", read by parse_figure_mark
FIGURE_MARK = re.compile(
    r"<!--\s*figure:\s*(?P<mark>(?:(?!-->).)*?)\s*-->"
    # models sometimes put the description in a comment of its own
    r"(?:[ \t]*\n?[ \t]*<!--(?!\s*(?:figure:|page:|regions?\b|/region))"
    r"\s*(?P<after>.*?)\s*-->)?",
    re.DOTALL,
)
FIGURE_ID = re.compile(r"^\s*(p\d+_\d+|new)\s*(?:\||$)")
FIGURE_BOX = re.compile(r"^\s*([\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+)\s*$")


def parse_figure_mark(mark: str) -> tuple[str, str, str | None]:
    """
    (id, description, box) of a figure mark "<id> | <description> | <box>".
    The id may be missing and descriptions may contain |, so the id is the
    first field only when it looks like one, and the box is the last.
    """
    mark = mark.replace("\\|", "|")
    figure_id = "new"
    if match := FIGURE_ID.match(mark):
        figure_id, mark = match[1], mark[match.end() :]
    head, bar, last = mark.rpartition("|")
    box = None
    if bar and (match := FIGURE_BOX.match(last)):
        box, mark = match[1], head
    return figure_id, mark.strip(), box


def fraction_box(box: str) -> list[float] | None:
    """
    Parse a box "x0,y0,x1,y1" of fractions, each clamped to 0-1; None when it
    isn't one.
    """
    try:
        values = [min(max(float(v), 0.0), 1.0) for v in box.split(",")]
    except ValueError:
        return None
    return values if is_box(values) else None


# a region in the page OCR: its transcription between the marks
REGION_MARKED = re.compile(
    r"<!--\s*region:\s*(?P<id>p\d+_\d+|new)\s*"
    r"(?:\|\s*(?P<description>[^|]*?))?\s*"
    r"(?:\|\s*(?P<box>[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+))?\s*-->"
    r"(?P<body>.*?)<!--\s*/region\s*-->",
    re.DOTALL,
)
# a region in a region's own OCR (standard parse)
REGION_START = re.compile(
    r"^\s*<!--\s*region:\s*(?P<description>.*?)\s*-->"
    r"(?P<body>.*?)(?:<!--\s*/region\s*-->)?\s*$",
    re.DOTALL,
)
REGIONS_LINE = re.compile(r"<!--\s*regions:\s*(?P<items>.*?)-->", re.DOTALL)
REGION_FIGURE = re.compile(
    r"^\s*<!--\s*(?:figure:)?\s*(?P<description>.*?)\s*-->\s*$", re.DOTALL
)


def region_decisions(text: str) -> tuple[str, dict[str, str]]:
    """
    Remove the model's `<!-- regions: ... -->` line; return {id: graphic|transcribed}.
    """
    decisions: dict[str, str] = {}
    for match in REGIONS_LINE.finditer(text):
        for item in re.split(r"[,;\s]+", match["items"]):
            key, _, value = item.partition("=")
            if key and value:
                value = value.strip().lower()
                decisions[key.strip()] = (
                    GRAPHIC
                    if value.startswith("graph")
                    else REGION
                    if value.startswith("region")
                    else TRANSCRIBED
                )
    return REGIONS_LINE.sub("", text).rstrip(), decisions


# a drawing inside a mixed region, positioned as fractions of the region (its
# mark ends with the box; parse_figure_mark reads it)
REGION_MARK = re.compile(
    r"<!--\s*figure:\s*(?P<mark>(?:(?!-->).)*?"
    r"\|\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+)\s*-->",
    re.DOTALL,
)


def parse_region_ocr(text: str) -> tuple[str, str]:
    """
    (GRAPHIC, description), (TRANSCRIBED, markdown), (MIXED, markdown with
    REGION_MARK comments where its drawings are) or (REGION, the text as the
    model wrote it, for REGION_START) for a region's OCR output.
    """
    text = (text or "").strip()
    if REGION_START.match(text):
        return REGION, text
    if REGION_MARK.search(text):
        return MIXED, text
    only_comment = REGION_FIGURE.match(text)
    if only_comment and "-->" not in only_comment["description"]:
        return GRAPHIC, only_comment["description"]
    if not text:
        return GRAPHIC, ""
    return TRANSCRIBED, text


# A crop with less than this fraction of pixels away from its main colour is
# blank (of 5,236 crops, 156 were under 0.001; up to 0.003 they are empty
# boxes and stray rules, above that small marks start)
BLANK_INK = 0.003
# a pixel this much lighter or darker (of 255) than the main colour is ink
INK_CONTRAST = 24


def is_blank(image: Image.Image) -> bool:
    """Return whether a crop shows nothing but one colour."""
    gray = np.asarray(image.convert("L"), dtype=np.int16)
    away = np.abs(gray - np.median(gray)) > INK_CONTRAST
    return float(np.mean(away)) < BLANK_INK


# --- Snapping an approximate box to the page ----------------------------------

INK_THRESHOLD = 235
SNAP_MARGIN = 0.12  # search this far (fraction of the box size) around the guess
# smaller ink blobs (pixels) are specks
MIN_BLOB_AREA = 30


def snap_to_ink(page_image: Image.Image, box: list[float]) -> list[float]:
    """
    Tighten an approximate box (pixels: left, top, right, bottom) to the ink
    of the graphic it covers: the dilated ink blobs mostly inside the guess,
    searched in a slightly larger area. Returns the guess if no ink is found.
    """
    gray = np.array(page_image.convert("L"))
    height, width = gray.shape
    left, top, right, bottom = box
    mx = (right - left) * SNAP_MARGIN + 6
    my = (bottom - top) * SNAP_MARGIN + 6
    sx0, sy0 = max(0, int(left - mx)), max(0, int(top - my))
    sx1, sy1 = min(width, int(right + mx)), min(height, int(bottom + my))
    if sx1 <= sx0 or sy1 <= sy0:
        return box
    ink = (gray[sy0:sy1, sx0:sx1] < INK_THRESHOLD).astype(np.uint8)
    blobs = cv2.dilate(ink, np.ones((7, 7), np.uint8))
    count, _, stats, _ = cv2.connectedComponentsWithStats(blobs)
    keep = []
    for i in range(1, count):
        x, y, w, h, area = stats[i]
        if area < MIN_BLOB_AREA:
            continue
        # overlap of the blob's box with the guess
        ox = max(0, min(x + w + sx0, right) - max(x + sx0, left))
        oy = max(0, min(y + h + sy0, bottom) - max(y + sy0, top))
        if ox * oy >= 0.5 * w * h:
            keep.append((x + sx0, y + sy0, x + w + sx0, y + h + sy0))
    if not keep:
        return box
    return [
        min(k[0] for k in keep),
        min(k[1] for k in keep),
        max(k[2] for k in keep),
        max(k[3] for k in keep),
    ]


@dataclass
class FigureOutput:
    """Where graphics are saved as PNGs, and how the markdown links them."""

    directory: Path
    # each file is named <file_prefix><figure id>.png
    file_prefix: str = ""
    # and linked as <link_prefix><file name>; by default "<directory name>/"
    link_prefix: str | None = None

    def filename(self, figure: Figure) -> str:
        """Return the file name of a figure's crop."""
        return f"{self.file_prefix}{figure.figure_id}.png"

    def link(self, figure: Figure) -> str:
        """Return the link to a figure's crop."""
        prefix = self.link_prefix
        if prefix is None:
            prefix = f"{self.directory.name}/"
        return f"{prefix}{self.filename(figure)}"
