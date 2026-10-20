"""
PDF to Markdown converter using OpenDataLoader JSON output and LLM-based OCR.

Strategy:
1. Parse PDF structure.
2. Calculate a "Math Density Score" for each page .
3. Decision Logic:
   - High Score (> Threshold): OCR the entire page (preserves complex layout/formulas).
   - Low Score: Use standard parsed text and only OCR specific embedded images.
"""

import base64
import gc
import json
import logging
import re
import tempfile
import uuid
from collections import OrderedDict, defaultdict
from collections.abc import Iterator
from dataclasses import dataclass, field
from io import BytesIO
from pathlib import Path
from typing import Any

import cv2
import litellm
import numpy as np
import opendataloader_pdf
import pdf2image
from django.conf import settings
from litellm import batch_completion
from PIL import Image

log = logging.getLogger(__name__)

# drop unsupported model params
litellm.drop_params = True

# --- Configuration ---
MIN_IMAGE_DIMENSION = 32
MIN_IMAGE_RATIO = 12
IMAGE_BATCH_SIZE = 10
PDF_POINTS_PER_INCH = 72
UNIQUE_COLOR_THRESHOLD = 200
# Number of rendered pages kept in memory at once
PAGE_CACHE_SIZE = 4
OCR_FAILED_PLACEHOLDER = "<!-- OCR failed for this region -->"

# Score > 5 triggers full page OCR.


MATH_FONTS = {"cmmi", "cmsy", "cmex", "msbm", "msam", "eufm", "dsrom", "wasy", "stmary"}


BASIC_MATH_SYMBOLS = re.compile(r"[+=<>≤≥≠±\-]")
# Regex for "Complex" math (Integrals, Sums, Keywords)
COMPLEX_MATH_REGEX = re.compile(
    r"([∑∏∫∂∇√∞∀∃∈⊂∪→⇒⇔αβγδεθλμπστφωΩΓΛΨ]|\b(lim|sin|cos|tan|log|ln|det|mod)\b)"  # noqa: RUF001
)
# Private Use Area glyphs (e.g. old equation-editor / Symbol font pieces) and the
# replacement character carry no meaning as text, so the page needs full OCR
UNMAPPABLE_GLYPH_REGEX = re.compile("[\ue000-\uf8ff\ufffd]")
# List item text that already starts with its own label, e.g. "1.", "(a)", "iv)"
LIST_LABEL_REGEX = re.compile(r"^\s*\(?(\d+|[a-zA-Z]|[ivxlcdmIVXLCDM]+)[.)](\s|$)")


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


@dataclass
class ImageForOCR:
    block_id: int
    image_uri: str
    is_full_page: bool

    @classmethod
    def from_pil_image(
        cls, block_id: int, pil_image: Image.Image, *, is_full_page: bool
    ) -> "ImageForOCR":
        """Encode the image up front so the bitmap doesn't need to be kept around"""
        return cls(block_id, _image_to_base64_uri(pil_image), is_full_page)


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


def _optimize_image(pil_image: Image.Image) -> Image.Image:
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


class PDFPageRenderer:
    def __init__(self, document_path: Path, dpi: int = 150):
        self.document_path = document_path
        self.dpi = dpi
        self._page_cache: OrderedDict[int, Image.Image] = OrderedDict()
        self._scale = dpi / PDF_POINTS_PER_INCH

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
        pil_x1 = int(pdf_x1 * self._scale)
        pil_x2 = int(pdf_x2 * self._scale)
        pil_y1 = int(page_height - (pdf_y2 * self._scale))
        pil_y2 = int(page_height - (pdf_y1 * self._scale))

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

    def process_images(self, images: list[ImageForOCR]) -> dict[int, str]:
        """
        Batch OCR images
        """
        if not images:
            return {}
        block_ids = [img.block_id for img in images]
        messages = self._prepare_messages(images)
        ocr_texts = self._execute_batch_ocr(messages)
        return dict(zip(block_ids, ocr_texts, strict=True))

    def _prepare_messages(self, images: list[ImageForOCR]) -> list[list[dict]]:
        return [
            _build_ocr_message(img.image_uri, settings.OCR_PROMPT) for img in images
        ]

    def _completion_kwargs(self) -> dict[str, Any]:
        return {
            "custom_llm_provider": settings.LITELLM_CUSTOM_PROVIDER,
            "api_base": settings.LITELLM_API_BASE,
            "model": settings.OCR_MODEL,
            "timeout": settings.OCR_REQUEST_TIMEOUT,
            "num_retries": settings.OCR_REQUEST_NUM_RETRIES,
        }

    def _execute_batch_ocr(self, messages_list: list[list[dict]]) -> list[str]:
        all_texts = []
        for i in range(0, len(messages_list), self.batch_size):
            batch = messages_list[i : i + self.batch_size]
            responses = batch_completion(messages=batch, **self._completion_kwargs())
            all_texts.extend(
                self._response_text(messages, resp)
                for messages, resp in zip(batch, responses, strict=True)
            )
            gc.collect()
        return all_texts

    def _response_text(self, messages: list[dict], response: Any) -> str:
        """
        Get the text of an OCR response. batch_completion returns the exception
        in place of a response for a failed request, so retry that request once
        and fall back to a placeholder if it fails again.
        """
        if isinstance(response, Exception):
            log.warning("OCR request failed, retrying: %s", response)
            try:
                response = litellm.completion(
                    messages=messages, **self._completion_kwargs()
                )
            except Exception:
                log.exception("OCR request failed after retry")
                return OCR_FAILED_PLACEHOLDER
        return response.choices[0].message.content or ""


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
                        content=item.content,
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


class MarkdownAssembler:
    """
    Assembles markdown from parsed content blocks.

    Handles all content types from OpenDataLoader JSON output:
    - heading: Section headings with levels
    - paragraph: Text paragraphs
    - image: Embedded images (processed via OCR)
    - table: Tables with rows and cells
    - list: Flattened into its items and their nested blocks
    - text chunk / text block: Raw text content
    - line: Single lines of text
    - list item: Individual list items (when standalone)
    """

    def assemble(self, blocks: list[ContentBlock], ocr_results: dict[int, str]) -> str:
        formatted_parts = []
        for block in flatten_lists(blocks):
            # Full Page OCR overrides all individual blocks on that page
            if block.block_type == BlockType.FULL_PAGE_OCR:
                formatted_parts.append(ocr_results.get(block.block_id, ""))
                continue

            # Standard formatting
            text = self._format_block(block, ocr_results)
            if text:
                formatted_parts.append(text)
        return "\n\n".join(formatted_parts)

    def _format_block(
        self, block: ContentBlock, ocr_results: dict[int, str]
    ) -> str | None:
        """
        Format a content block to markdown.

        Supports all content types from OpenDataLoader:
        - heading: Markdown headings with # prefix
        - paragraph: Plain text paragraphs
        - image: OCR results or placeholder
        - table: Markdown tables with | separators
        - text chunk / text block / line: Plain text
        - list item: Single list item (when standalone)
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
            block_content = ocr_results.get(block.block_id)

        # Table
        if block_type == BlockType.TABLE:
            block_content = self._format_table(block)

        # Text chunk / text block / line - plain text content
        if block_type in (BlockType.TEXT_CHUNK, BlockType.TEXT_BLOCK, BlockType.LINE):
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

    def _format_table(self, block: ContentBlock) -> str | None:
        """
        Format a table block to markdown table syntax.
        """
        if not block.rows:
            # Try to extract table from nested kids structure
            return self._format_table_from_kids(block)

        lines = []
        num_cols = block.number_of_columns or self._detect_column_count(block.rows)

        for row_idx, row in enumerate(block.rows):
            # Build row content
            cells_content = []
            for cell in row.cells:
                cell_text = self._get_cell_content(cell)
                # Replace newlines with HTML breaks for table cells
                cell_text = cell_text.replace("\n", "<br>") if cell_text else ""
                cells_content.append(cell_text)

            # Pad if fewer cells than expected
            while len(cells_content) < num_cols:
                cells_content.append("")

            row_line = "| " + " | ".join(cells_content) + " |"
            lines.append(row_line)

            # Add header separator after first row
            if row_idx == 0:
                separator = "| " + " | ".join(["---"] * num_cols) + " |"
                lines.append(separator)

        return "\n".join(lines) if lines else None

    def _format_table_from_kids(self, block: ContentBlock) -> str | None:
        """
        Format table when structure is in 'kids' field rather than 'rows'.
        """
        if not block.kids:
            return None

        lines = []
        num_cols = block.number_of_columns or 0
        row_idx = 0

        for kid in block.kids:
            if isinstance(kid, dict) and kid.get("type") == BlockType.TABLE_ROW:
                cells = kid.get("cells", [])
                cells_content = []

                for cell_data in cells:
                    if isinstance(cell_data, dict):
                        cell_text = cell_data.get("content", "")
                        # Handle nested kids in cell
                        if not cell_text and "kids" in cell_data:
                            cell_text = self._extract_text_from_kids(cell_data["kids"])
                    else:
                        cell_text = str(cell_data) if cell_data else ""

                    cell_text = cell_text.replace("\n", "<br>") if cell_text else ""
                    cells_content.append(cell_text)

                if not num_cols:
                    num_cols = len(cells_content)

                while len(cells_content) < num_cols:
                    cells_content.append("")

                row_line = "| " + " | ".join(cells_content) + " |"
                lines.append(row_line)

                if row_idx == 0:
                    separator = "| " + " | ".join(["---"] * num_cols) + " |"
                    lines.append(separator)

                row_idx += 1

        return "\n".join(lines) if lines else None

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
                if "content" in kid:
                    texts.append(kid["content"])
                if "kids" in kid:
                    texts.append(self._extract_text_from_kids(kid["kids"]))
            elif isinstance(kid, str):
                texts.append(kid)
        return " ".join(filter(None, texts))

    def _detect_column_count(self, rows: list[TableRow]) -> int:
        """Detect number of columns from rows."""
        if not rows:
            return 0
        return max(len(row.cells) for row in rows)


class OpenDataLoaderLLMConverter:
    def __init__(
        self,
        document_path: Path,
        output_dir: Path | None = None,
        pdf_dpi: int = 150,
        *,
        debug_mode=False,
    ):
        self.document_path = Path(document_path)
        self.debug_mode = debug_mode
        self._tempdir = tempfile.TemporaryDirectory()
        self.output_dir = output_dir or Path(self._tempdir.name)
        self._page_renderer = PDFPageRenderer(self.document_path, dpi=pdf_dpi)
        self._ocr_processor = OCRProcessor()
        self._markdown_assembler = MarkdownAssembler()

        if debug_mode:
            litellm._turn_on_debug()  # noqa: SLF001

    @property
    def _debug_dir(self) -> Path:
        d = Path(settings.OCR_DEBUG_DIRECTORY) / self.document_path.stem
        d.mkdir(parents=True, exist_ok=True)
        return d

    def _save_debug_image(self, pil_image: Image.Image, prefix: str = "") -> str:
        fp = self._debug_dir / f"{prefix}{self.document_path.name}-{uuid.uuid4()}.png"
        pil_image.save(fp)
        return str(fp)

    def _save_debug_markdown(self, markdown_content: str) -> str:
        fp = self._debug_dir / f"{self.document_path.name}.md"
        fp.write_text(markdown_content)
        return str(fp)

    def _convert_pdf_to_json(self) -> dict[str, Any]:
        self.output_dir.mkdir(parents=True, exist_ok=True)
        opendataloader_pdf.convert(
            input_path=[str(self.document_path)],
            output_dir=str(self.output_dir),
            format="json",
            use_struct_tree=True,
            keep_line_breaks=True,
        )
        return json.loads(
            (self.output_dir / f"{self.document_path.stem}.json").read_text()
        )

    def _parse_content_block(self, block_data: dict[str, Any]) -> ContentBlock:
        return parse_content_block(block_data)

    def _calculate_page_math_score(self, blocks: list[ContentBlock]) -> int:
        """
        Calculate a score representing 'math density' for a page.
        """
        score = 0
        for b in blocks:
            for font, content in _iter_block_text(b):
                if font:
                    font_base = "".join([c for c in font.lower() if c.isalpha()])
                    if any(mf in font_base for mf in MATH_FONTS):
                        score += 1

                if content:
                    text = content.strip()
                    if COMPLEX_MATH_REGEX.search(text):
                        score += 3
                    elif BASIC_MATH_SYMBOLS.search(text):
                        score += 1
        return score

    def _has_unmappable_glyphs(self, blocks: list[ContentBlock]) -> bool:
        """
        Check whether a page's text layer contains glyphs that can't be decoded
        """
        return any(
            content and UNMAPPABLE_GLYPH_REGEX.search(content)
            for b in blocks
            for _, content in _iter_block_text(b)
        )

    def convert_to_markdown(self) -> str:
        try:
            # get document elements and structure as json
            json_data = self._convert_pdf_to_json()
            # Lists are flattened first so that their nested blocks are grouped
            # under their own pages and nested images get OCR'd
            raw_blocks = flatten_lists(
                [self._parse_content_block(k) for k in json_data.get("kids", [])]
            )

            # Group by Page
            pages = defaultdict(list)
            for b in raw_blocks:
                pages[b.page_number].append(b)

            final_blocks = []
            images_for_ocr = []

            # Process Per Page
            for page_num in sorted(pages.keys()):
                page_blocks = pages[page_num]

                math_score = self._calculate_page_math_score(page_blocks)
                has_unmappable_glyphs = self._has_unmappable_glyphs(page_blocks)
                should_full_ocr = (
                    math_score > settings.OCR_MATH_DENSITY_THRESHOLD
                    or has_unmappable_glyphs
                )

                if should_full_ocr:
                    log.info(
                        "Page %d: Math Score %d, unmappable glyphs: %s. "
                        "Strategy: Full Page OCR.",
                        page_num,
                        math_score,
                        has_unmappable_glyphs,
                    )

                    page_block_id = 888000 + page_num

                    full_page_img = self._page_renderer.get_page_image(page_num)
                    optimized_img = _optimize_image(full_page_img)
                    full_page_img.close()

                    images_for_ocr.append(
                        ImageForOCR.from_pil_image(
                            page_block_id, optimized_img, is_full_page=True
                        )
                    )

                    final_blocks.append(
                        ContentBlock(
                            block_type=BlockType.FULL_PAGE_OCR,
                            block_id=page_block_id,
                            page_number=page_num,
                            bounding_box=[],
                        )
                    )

                    if self.debug_mode:
                        self._save_debug_image(
                            optimized_img, prefix=f"FULLPAGE_{page_num}_"
                        )
                    optimized_img.close()

                else:
                    log.info(
                        "Page %d: Low Math Score (%d). Strategy: Standard Parse.",
                        page_num,
                        math_score,
                    )

                    for block in page_blocks:
                        final_blocks.append(block)

                        if block.block_type == BlockType.IMAGE:
                            img = self._page_renderer.extract_region(
                                block.page_number, block.bounding_box
                            )
                            if img:
                                opt = _optimize_image(img)
                                img.close()
                                images_for_ocr.append(
                                    ImageForOCR.from_pil_image(
                                        block.block_id, opt, is_full_page=False
                                    )
                                )
                                if self.debug_mode:
                                    self._save_debug_image(
                                        opt, prefix=f"IMG_{block.block_id}_"
                                    )
                                opt.close()

            # Batch OCR
            ocr_results = self._ocr_processor.process_images(images_for_ocr)

            # Assemble
            final_md = self._markdown_assembler.assemble(final_blocks, ocr_results)

            if self.debug_mode:
                self._save_debug_markdown(final_md)

            return final_md

        finally:
            self._page_renderer.cleanup()
