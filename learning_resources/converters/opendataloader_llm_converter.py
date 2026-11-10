"""
PDF to Markdown converter using OpenDataLoader JSON output and LLM-based OCR.

Strategy:
1. Parse PDF structure.
2. Decide each page's strategy. A page is OCR'd in full when its parsed text
   can't stand for it: a high "math density" score, a scanned page, glyphs
   with no Unicode meaning, equation-editor bracket pieces, or a text layer the
   parser lost or that is scrambled or letter-spaced. Otherwise its parsed text
   is used, and only its candidate figures are OCR'd.
3. Figures: candidates come from the PDF's own objects (images, form XObjects,
   clusters of vector paths). The OCR model decides whether each is a graphic
   (kept as a placeholder comment, or a markdown image when figure_output is
   given), text to transcribe, or a region shown as both.
4. Clean up: running headers, footers and page numbers are removed, text the
   parser split into fragments is rejoined, and figure transcriptions that
   repeat parsed text are dropped. Each page starts with <!-- page: N -->.
5. Optionally (structure()), the markdown is split into problems, parts and
   solutions by source ranges the model labels; it never rewrites the text.

The helpers live in utils.py and the structuring pass in structure.py.
"""

import json
import logging
import re
import tempfile
import uuid
from collections import defaultdict
from pathlib import Path
from typing import Any

import opendataloader_pdf
import pypdfium2 as pdfium
from django.conf import settings
from PIL import Image

from learning_resources.converters.structure import (
    MAX_LOGGED_STRUCTURE_ERRORS,
    export_structure_markdown,
    structure_document,
)
from learning_resources.converters.utils import (
    BLANK,
    DEFAULT_PAGE_SIZE,
    FIGURE_MARK,
    FIGURE_PADDING,
    FROM_OCR,
    GRAPHIC,
    LATEX_COMMAND,
    MIXED,
    PARSED_LINE_MIN_WORDS,
    PDFIUM_LOCK,
    REGION,
    REGION_MARK,
    REGION_MARKED,
    REGION_PROMPT,
    REGION_START,
    TABLE_BOX_GAP,
    TABLE_BOX_SHARE,
    TABLE_WORD,
    TABLE_WORD_SHARE,
    TRANSCRIBED,
    UNDECIDED,
    BlockType,
    ContentBlock,
    Figure,
    FigureOutput,
    ImageForOCR,
    MarkdownAssembler,
    OCRProcessor,
    PageMath,
    PDFPageRenderer,
    Usage,
    _optimize_image,
    _unwrap_header_footer,
    display_box,
    document_math,
    find_figure_boxes,
    flatten_lists,
    fraction_box,
    has_equation_pieces,
    has_unmappable_text,
    is_blank,
    is_box,
    is_scanned_page,
    iter_text,
    page_math_score,
    page_prompt,
    parse_content_block,
    parse_figure_mark,
    parse_region_ocr,
    plain_words,
    region_decisions,
    share_inside,
    snap_to_ink,
    strip_running_lines,
    text_lost_reason,
    turn_on_litellm_debug,
)

log = logging.getLogger(__name__)

# ids of the blocks standing for a page's full-page OCR (plus its page number)
# and for a figure candidate (plus its index in figures)
FULL_PAGE_BLOCK_ID = 888000
FIGURE_BLOCK_ID = 999000


class OpenDataLoaderLLMConverter:
    """
    Convert a PDF to markdown: its parsed text where that stands for a page,
    and LLM OCR for the rest and for its figures.
    """

    def __init__(
        self,
        document_path: Path,
        *,
        figure_output: FigureOutput | None = None,
        json_path: Path | None = None,
        pdf_dpi: int = 150,
        debug_mode: bool = False,
    ):
        """
        With figure_output, graphics are cropped and saved there and embedded in
        the markdown as images; otherwise they appear as placeholder comments.
        json_path is opendataloader's JSON for this PDF, when it was parsed in a
        batch of PDFs (one JVM for many files); otherwise it is parsed here.
        """
        self.document_path = Path(document_path)
        self.figure_output = figure_output
        self.json_path = Path(json_path) if json_path else None
        self.debug_mode = debug_mode
        self._tempdir = tempfile.TemporaryDirectory()
        self._page_renderer = PDFPageRenderer(self.document_path, dpi=pdf_dpi)
        self._ocr_processor = OCRProcessor()
        self._markdown_assembler = MarkdownAssembler()
        self.figures: list[Figure] = []
        self._page_sizes: dict[int, tuple[float, float]] = {}
        # each page's text layer as the PDF has it, and whether it draws anything
        self._layer_text: dict[int, str] = {}
        self._has_content: dict[int, bool] = {}
        self._page_math: dict[int, PageMath] | None = None
        if debug_mode:
            turn_on_litellm_debug()

    # --- Public API -------------------------------------------------------------

    def convert_to_markdown(self) -> str:
        """Convert the PDF to markdown."""
        try:
            final_blocks, images_for_ocr = self._prepare()
            ocr_results = self._ocr_processor.process_images(images_for_ocr)
            return self._finish(final_blocks, ocr_results)
        finally:
            self._page_renderer.cleanup()

    def structure(self, markdown: str, metadata: dict | None = None) -> dict:
        """
        Split this document's converted markdown into problems, parts and
        solutions (structure_document), counting the requests' usage here.
        """
        return structure_document(markdown, self.usage, metadata=metadata)

    def convert_to_structured_markdown(self, metadata: dict | None = None) -> str:
        """
        Convert the PDF to markdown tagged with its problems, parts and solutions.
        If structuring fails its checks, the untagged markdown is returned.
        """
        markdown = self.convert_to_markdown()
        if not markdown.strip():
            return markdown
        try:
            result = self.structure(markdown, metadata=metadata)
        except Exception:
            log.exception("Structuring %s failed", self.document_path.name)
            return markdown
        if result["status"] != "validated":
            log.warning(
                "Structure of %s needs review, keeping it untagged: %s",
                self.document_path.name,
                result["check"]["errors"][:MAX_LOGGED_STRUCTURE_ERRORS],
            )
            return markdown
        return export_structure_markdown(markdown, result)

    @property
    def usage(self) -> Usage:
        """Tokens used by this converter's OCR and structure requests."""
        return self._ocr_processor.usage

    @property
    def graphics(self) -> list[Figure]:
        """Figures shown as crops: graphics and regions."""
        return [f for f in self.figures if f.kind in (GRAPHIC, REGION)]

    # --- Parsing and page strategy ----------------------------------------------

    def _prepare(self) -> tuple[list[ContentBlock], list[ImageForOCR]]:
        """Parse the PDF, find figures and decide each page's strategy."""
        # Lists are flattened first so that their nested blocks are grouped
        # under their own pages and nested images get OCR'd
        kids = _unwrap_header_footer(self._convert_pdf_to_json().get("kids", []))
        raw_blocks = flatten_lists([parse_content_block(k) for k in kids])
        self._turn_blocks(raw_blocks)
        pages = defaultdict(list)
        for b in raw_blocks:
            pages[b.page_number].append(b)
        self._find_figures(pages)

        final_blocks, images_for_ocr = [], []
        for page_num in sorted(pages):
            page_blocks = pages[page_num]
            math_score = page_math_score(page_blocks)
            if math_score > settings.OCR_MATH_DENSITY_THRESHOLD:
                reason = f"High Math Score ({math_score})"
            else:
                reason = self._text_layer_problem(
                    page_num, page_blocks
                ) or self._inline_math_problem(page_num)
            if reason:
                log.info("Page %d: %s. Strategy: Full Page OCR.", page_num, reason)
                block, image = self._full_page_ocr(page_num, page_blocks)
                final_blocks.append(block)
                images_for_ocr.append(image)
                continue
            log.info(
                "Page %d: Low Math Score (%d). Strategy: Standard Parse.",
                page_num,
                math_score,
            )
            for block in self._with_figure_blocks(page_num, page_blocks):
                final_blocks.append(block)
                if block.block_type == BlockType.IMAGE and (
                    image := self._block_image(block)
                ):
                    images_for_ocr.append(image)
        return final_blocks, images_for_ocr

    def _convert_pdf_to_json(self) -> dict[str, Any]:
        if self.json_path:
            return json.loads(self.json_path.read_text())
        output_dir = Path(self._tempdir.name)
        opendataloader_pdf.convert(
            input_path=[str(self.document_path)],
            output_dir=str(output_dir),
            format="json",
            use_struct_tree=True,
            keep_line_breaks=True,
            # headers and footers are kept for _unwrap_header_footer to sort
            include_header_footer=True,
        )
        return json.loads((output_dir / f"{self.document_path.stem}.json").read_text())

    def _turn_blocks(self, blocks: list[ContentBlock]) -> None:
        """
        Put the parser's boxes, which are in each page's unrotated space, on
        the page as shown (display_box): that is how pages are rendered and
        cropped, and how figure boxes are found.
        """
        turns = {}
        with PDFIUM_LOCK:
            pdf = pdfium.PdfDocument(self.document_path)
            try:
                for i in range(len(pdf)):
                    page = pdf[i]
                    if page.get_rotation():
                        turns[i + 1] = (
                            page.get_rotation(),
                            page.get_width(),
                            page.get_height(),
                        )
                    page.close()
            finally:
                pdf.close()
        for b in blocks:
            if b.page_number in turns and is_box(b.bounding_box):
                b.bounding_box = display_box(b.bounding_box, *turns[b.page_number])

    def _find_figures(self, pages: dict[int, list[ContentBlock]]) -> None:
        """
        Find each page's candidate figures, numbered top to bottom (p<page>_<n>),
        and note each page's own text layer. Every page of the PDF gets an
        entry in pages, also one the parser returned nothing for.
        """
        with PDFIUM_LOCK:
            pdf = pdfium.PdfDocument(self.document_path)
            try:
                for page_num in range(1, len(pdf) + 1):
                    pages.setdefault(page_num, [])
                    page = pdf[page_num - 1]
                    textpage = page.get_textpage()
                    self._layer_text[page_num] = textpage.get_text_range()
                    textpage.close()
                    self._has_content[page_num] = any(
                        True for _ in page.get_objects(max_depth=0)
                    )
                    text_blocks = [
                        (b.bounding_box, b.content or "")
                        for b in pages[page_num]
                        if b.block_type != BlockType.IMAGE
                    ]
                    boxes = find_figure_boxes(page, text_blocks)
                    width, height = page.get_width(), page.get_height()
                    self._page_sizes[page_num] = (width, height)
                    page.close()
                    self.figures += [
                        Figure(
                            f"p{page_num}_{index}",
                            page_num,
                            box,
                            page_width=width,
                            page_height=height,
                            side_by_side=side_by_side,
                        )
                        for index, (box, side_by_side) in enumerate(boxes, start=1)
                    ]
            finally:
                pdf.close()

    def _text_layer_problem(
        self, page_num: int, blocks: list[ContentBlock]
    ) -> str | None:
        """Why the page's parsed text can't stand for it, if it can't."""
        page_size = self._page_sizes.get(page_num, DEFAULT_PAGE_SIZE)
        # a scanned page has no text layer to parse
        if is_scanned_page(blocks, page_size):
            return "Scanned page"
        # nor does one whose text uses glyphs with no Unicode meaning
        if has_unmappable_text(blocks):
            return "Unmappable glyphs in text layer"
        # or that draws matrices from bracket pieces
        if has_equation_pieces(blocks):
            return "Bracket pieces in text layer"
        # or whose text the parser couldn't read
        return text_lost_reason(
            self._layer_text.get(page_num, ""),
            blocks,
            has_content=bool(self._has_content.get(page_num)),
        )

    def _inline_math_problem(self, page_num: int) -> str | None:
        """Describe the page's inline math, if the parsed text would flatten it."""
        if not settings.OCR_INLINE_MATH:
            return None
        if self._page_math is None:
            try:
                self._page_math = document_math(self.document_path)
            except Exception:
                log.warning(
                    "Couldn't read the text layer's fonts in %s",
                    self.document_path,
                    exc_info=True,
                )
                self._page_math = {}
        math = self._page_math.get(page_num)
        if math and math.flattened:
            return f"Inline math in the text layer ({math})"
        return None

    def _full_page_ocr(
        self, page_num: int, page_blocks: list[ContentBlock]
    ) -> tuple[ContentBlock, ImageForOCR]:
        """Return the block standing for a page OCR'd in full, and its image."""
        block_id = FULL_PAGE_BLOCK_ID + page_num
        page_image = self._page_renderer.get_page_image(page_num)
        optimized = _optimize_image(page_image)
        page_image.close()
        if self.debug_mode:
            self._save_debug_image(optimized, prefix=f"FULLPAGE_{page_num}_")
        image = ImageForOCR.from_pil_image(
            block_id,
            optimized,
            is_full_page=True,
            prompt=page_prompt(settings.OCR_PROMPT, self._page_figures(page_num)),
        )
        optimized.close()
        block = ContentBlock(
            block_type=BlockType.FULL_PAGE_OCR,
            block_id=block_id,
            page_number=page_num,
            bounding_box=[],
            fallback_blocks=page_blocks,
        )
        return block, image

    def _block_image(self, block: ContentBlock) -> ImageForOCR | None:
        """Return the image of an image block or figure candidate, to OCR."""
        crop = self._page_renderer.extract_region(block.page_number, block.bounding_box)
        if not crop:
            return None
        is_figure = block.block_id >= FIGURE_BLOCK_ID
        # figure regions stay in colour so a photo is described as it is
        optimized = crop.convert("RGB") if is_figure else _optimize_image(crop)
        if self.debug_mode:
            self._save_debug_image(optimized, prefix=f"IMG_{block.block_id}_")
        image = ImageForOCR.from_pil_image(
            block.block_id,
            optimized,
            is_full_page=False,
            prompt=REGION_PROMPT if is_figure else None,
        )
        optimized.close()
        crop.close()
        return image

    # --- Figures ----------------------------------------------------------------

    def _page_figures(self, page_num: int) -> list[Figure]:
        return [f for f in self.figures if f.page_number == page_num]

    def _figure_block_id(self, figure: Figure) -> int:
        return FIGURE_BLOCK_ID + self.figures.index(figure)

    def _figure_text(self, figure: Figure) -> str:
        """How a graphic appears in the markdown."""
        if self.figure_output:
            return figure.image_markdown(self.figure_output.link(figure))
        return figure.placeholder()

    def _region_text(self, figure: Figure, transcription: str) -> str:
        """How a region appears in the markdown: its crop, then its transcription."""
        return figure.region_markdown(self._figure_text(figure), transcription)

    def _with_figure_blocks(
        self, page_num: int, blocks: list[ContentBlock]
    ) -> list[ContentBlock]:
        """
        For a standard-parse page: one IMAGE block per candidate figure (vector
        drawings included), in reading order, in place of the image blocks and
        label text inside it. Its OCR decides whether it is a graphic.
        """
        figures = self._page_figures(page_num)
        if not figures:
            return blocks

        def inside(block: ContentBlock, figure: Figure) -> bool:
            if not is_box(block.bounding_box):
                return False
            x1, y1, x2, y2 = block.bounding_box
            fx1, fy1, fx2, fy2 = figure.bounding_box
            gap = FIGURE_PADDING
            return (
                x1 >= fx1 - gap
                and x2 <= fx2 + gap
                and y1 >= fy1 - gap
                and y2 <= fy2 + gap
            )

        kept = [b for b in blocks if not any(inside(b, f) for f in figures)]
        for i, figure in enumerate(figures):
            figure_block = ContentBlock(
                block_type=BlockType.IMAGE,
                block_id=self._figure_block_id(figure),
                page_number=page_num,
                bounding_box=figure.bounding_box,
                # the parsed text it replaces, written after it if its OCR fails
                fallback_blocks=[
                    b
                    for b in blocks
                    if b.block_type != BlockType.IMAGE
                    and inside(b, figure)
                    and not any(inside(b, f) for f in figures[:i])
                ],
            )
            # before the first block that starts below the figure's top
            top = figure.bounding_box[3]
            index = next(
                (
                    j
                    for j, b in enumerate(kept)
                    if is_box(b.bounding_box)
                    and b.bounding_box[3] < top
                    and b.block_type != BlockType.IMAGE
                ),
                len(kept),
            )
            kept.insert(index, figure_block)
        return kept

    def _new_figure(
        self, page_num: int, description: str, box: str | None, kind: str = GRAPHIC
    ) -> Figure | None:
        """
        Add a graphic (or region) the full-page OCR found that the PDF didn't show.
        """
        fractions = fraction_box(box) if box else None
        if not fractions:
            return None
        fx0, fy0, fx1, fy1 = fractions
        if fx1 <= fx0 or fy1 <= fy0:
            return None
        page_image = self._page_renderer.get_page_image(page_num)
        w, h = page_image.size
        left, top, right, bottom = snap_to_ink(
            page_image, [fx0 * w, fy0 * h, fx1 * w, fy1 * h]
        )
        page_image.close()
        scale = self._page_renderer.scale
        page_width, page_height = w / scale, h / scale
        existing = [
            int(f.figure_id.split("_")[1]) for f in self._page_figures(page_num)
        ]
        figure = Figure(
            f"p{page_num}_{max(existing, default=0) + 1}",
            page_num,
            [
                left / scale,
                page_height - bottom / scale,
                right / scale,
                page_height - top / scale,
            ],
            page_width=page_width,
            page_height=page_height,
            kind=kind,
            source=FROM_OCR,
            description=description,
        )
        self.figures.append(figure)
        return figure

    def _split_mixed_region(self, region: Figure, text: str) -> str:
        """
        Split a region of text with drawings inside: keep the transcription and turn
        each drawing (positioned as fractions of the region) into a graphic of
        its own, snapped to the ink on the page.
        """
        x0, y0, x1, y1 = region.bbox  # PDF points from the page's top-left
        w, h = region.page_width or 1, region.page_height or 1

        def expand(match: re.Match) -> str:
            _, description, region_box = parse_figure_mark(match["mark"])
            fractions = fraction_box(region_box)
            if not fractions:
                return ""
            rx0, ry0, rx1, ry1 = fractions
            box = ",".join(
                f"{v:.4f}"
                for v in (
                    (x0 + rx0 * (x1 - x0)) / w,
                    (y0 + ry0 * (y1 - y0)) / h,
                    (x0 + rx1 * (x1 - x0)) / w,
                    (y0 + ry1 * (y1 - y0)) / h,
                )
            )
            figure = self._new_figure(region.page_number, description, box)
            return self._figure_text(figure) if figure else ""

        return REGION_MARK.sub(expand, text)

    def _resolve_full_page(self, page_num: int, text: str) -> str:
        """Turn the model's figure marks into graphics; the rest was transcribed."""
        text, decisions = region_decisions(text)
        by_id = {f.figure_id: f for f in self._page_figures(page_num)}
        placed: set[str] = set()
        text = REGION_MARKED.sub(
            lambda match: self._place_region(match, page_num, by_id, placed), text
        )
        text = FIGURE_MARK.sub(
            lambda match: self._place_graphic(match, page_num, by_id, placed), text
        )
        missing = []
        for figure_id, figure in by_id.items():
            if figure_id in placed:
                continue
            if decisions.get(figure_id) in (TRANSCRIBED, REGION):
                # (a region the model didn't wrap is still transcribed)
                figure.kind = TRANSCRIBED
                continue
            # a graphic the model didn't place (or didn't decide): keep it
            if figure_id not in decisions:
                log.info(
                    "Page %d: %s undecided, kept as a graphic", page_num, figure_id
                )
            figure.kind = GRAPHIC
            missing.append(self._figure_text(figure))
        return "\n\n".join([text, *missing])

    def _place_region(
        self,
        match: re.Match,
        page_num: int,
        by_id: dict[str, Figure],
        placed: set[str],
    ) -> str:
        """Write a region the full-page OCR marked (REGION_MARKED)."""
        description = (match["description"] or "").strip()
        body = match["body"].strip()
        if match["id"] == "new":
            figure = self._new_figure(page_num, description, match["box"], kind=REGION)
        else:
            figure = by_id.get(match["id"])
        if figure is None or figure.figure_id in placed:
            # nowhere to crop from: the transcription alone
            return body
        figure.kind = REGION
        figure.description = description
        placed.add(figure.figure_id)
        return self._region_text(figure, body)

    def _place_graphic(
        self,
        match: re.Match,
        page_num: int,
        by_id: dict[str, Figure],
        placed: set[str],
    ) -> str:
        """Write a graphic the full-page OCR marked (FIGURE_MARK)."""
        figure_id, description, box = parse_figure_mark(match["mark"])
        description = description or (match["after"] or "").strip()
        if figure_id == "new":
            figure = self._new_figure(page_num, description, box)
        else:
            figure = by_id.get(figure_id)
            if figure is not None:
                figure.kind = GRAPHIC
                figure.description = description
        if figure is None or figure.figure_id in placed:
            return ""
        placed.add(figure.figure_id)
        return self._figure_text(figure)

    def _resolve_figures(
        self, blocks: list[ContentBlock], ocr_results: dict[int, str | None]
    ) -> None:
        """
        Decide each candidate (graphic or transcribed) and write it into the OCR text.
        """
        by_block = {self._figure_block_id(f): f for f in self.figures}
        for block in blocks:
            if block.block_type == BlockType.FULL_PAGE_OCR:
                text = ocr_results.get(block.block_id, "")
                if text is not None:
                    ocr_results[block.block_id] = self._resolve_full_page(
                        block.page_number, text
                    )
            elif block.block_id in by_block:
                ocr_results[block.block_id] = self._resolve_candidate(
                    by_block[block.block_id],
                    block,
                    blocks,
                    ocr_results.get(block.block_id),
                )
        for figure in self.figures:
            if figure.kind == UNDECIDED:
                figure.kind = GRAPHIC

    def _resolve_candidate(
        self,
        figure: Figure,
        block: ContentBlock,
        blocks: list[ContentBlock],
        text: str | None,
    ) -> str:
        """Decide a candidate from its OCR text (None if it failed); return its text."""
        if text is None:
            figure.kind = GRAPHIC
            return self._figure_text(figure)
        # its OCR stands for the parsed text inside it
        block.fallback_blocks = []
        kind, content = parse_region_ocr(text)
        content = self._without_parsed_lines(figure, content, blocks)
        figure.kind = TRANSCRIBED if kind == MIXED else kind
        if kind == REGION:
            match = REGION_START.match(content)
            figure.description = match["description"]
            return self._region_text(figure, match["body"])
        if kind == GRAPHIC:
            figure.description = content
            return self._figure_text(figure)
        if kind == MIXED:
            return self._split_mixed_region(figure, content)
        if self._in_parsed_table(figure, content, blocks):
            # the candidate was the table's cell borders: the table is already there
            return ""
        return content

    def _without_parsed_lines(
        self, figure: Figure, text: str, blocks: list[ContentBlock]
    ) -> str:
        """
        Drop transcription paragraphs the parser already read from a text block
        crossing the candidate's edge (the crop often cuts them mid-word).
        """
        if not text:
            return text
        crossing = [
            " ".join(plain_words(c) for _, c in iter_text([b]) if c)
            for b in blocks
            if b.page_number == figure.page_number
            and b.block_type != BlockType.IMAGE
            and is_box(b.bounding_box)
            and share_inside(b.bounding_box, figure.bounding_box, 0) > 0
        ]
        if not crossing:
            return text

        def repeated(paragraph: str) -> bool:
            words = plain_words(paragraph)
            return len(words.split()) >= PARSED_LINE_MIN_WORDS and any(
                words in native for native in crossing
            )

        paragraphs = re.split(r"\n\s*\n", text)
        kept = [
            p
            for p in paragraphs
            if p.lstrip().startswith(("<!--", "![")) or not repeated(p)
        ]
        return "\n\n".join(kept) if len(kept) < len(paragraphs) else text

    def _in_parsed_table(
        self, figure: Figure, text: str, blocks: list[ContentBlock]
    ) -> bool:
        """
        Whether a candidate transcribed as text lies in a parsed table that already
        has nearly all its words (the drawing was the table's ruling).
        """
        words = set(TABLE_WORD.findall(LATEX_COMMAND.sub(" ", text).lower()))
        if not words:
            return False
        for b in blocks:
            if (
                b.block_type != BlockType.TABLE
                or b.page_number != figure.page_number
                or not is_box(b.bounding_box)
                or share_inside(figure.bounding_box, b.bounding_box, TABLE_BOX_GAP)
                < TABLE_BOX_SHARE
            ):
                continue
            table = set(
                TABLE_WORD.findall(" ".join(c or "" for _, c in iter_text([b])).lower())
            )
            # (a word or so may differ: the OCR fixes the table's typos)
            missing = len(words - table)
            if (
                missing <= max(1, (1 - TABLE_WORD_SHARE) * len(words))
                and missing < len(words) / 2
            ):
                return True
        return False

    # --- Output -----------------------------------------------------------------

    def _finish(
        self, final_blocks: list[ContentBlock], ocr_results: dict[int, str | None]
    ) -> str:
        """Decide figures, save graphics and assemble the markdown."""
        self._resolve_figures(final_blocks, ocr_results)
        written = {f.figure_id: self._figure_text(f) for f in self.graphics}
        self._save_graphics()
        # graphics whose crop came out blank leave the markdown; ones with no
        # saved crop (rejected by extract_region) fall back to their placeholder
        for figure in self.figures:
            if figure.kind == BLANK:
                replacement = ""
            elif self.figure_output and figure.figure_id in written and not figure.path:
                replacement = figure.placeholder()
            else:
                continue
            for block_id, text in ocr_results.items():
                if isinstance(text, str) and written[figure.figure_id] in text:
                    ocr_results[block_id] = text.replace(
                        written[figure.figure_id], replacement
                    )
        markdown = strip_running_lines(
            self._markdown_assembler.assemble(final_blocks, ocr_results)
        )
        if self.debug_mode:
            self._save_debug_markdown(markdown)
        return markdown

    def _save_graphics(self) -> None:
        """Crop each graphic and region, in colour, from the page render."""
        if self.figure_output:
            self.figure_output.directory.mkdir(parents=True, exist_ok=True)
        for figure in self.graphics:
            x1, y1, x2, y2 = figure.bounding_box
            padded = [
                x1 - FIGURE_PADDING,
                y1 - FIGURE_PADDING,
                x2 + FIGURE_PADDING,
                y2 + FIGURE_PADDING,
            ]
            image = self._page_renderer.extract_region(figure.page_number, padded)
            if image is None:
                continue
            if figure.kind == GRAPHIC and is_blank(image):
                figure.kind = BLANK
            elif self.figure_output:
                figure.path = self.figure_output.directory / (
                    self.figure_output.filename(figure)
                )
                image.convert("RGB").save(figure.path, optimize=True)
            image.close()

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
