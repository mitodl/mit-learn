"""
LiteLLM Batch Completion Hybrid PDF Converter

Uses litellm.batch_completion() to send all images at once for instant
parallel processing. This is much simpler than the Batch API and gives
immediate results!
"""

import base64
import logging
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path

import fitz  # PyMuPDF
import litellm
import pdfplumber
from django.conf import settings
from litellm import batch_completion
from PIL import Image

# Enable debug mode if needed
litellm.set_verbose = True

log = logging.getLogger(__name__)

# Constants
MIN_IMAGE_SIZE = 20
MAX_IMAGE_SIZE = 1536
OVERLAP_THRESHOLD = 0.5


@dataclass
class ContentBlock:
    """Represents a content region on a PDF page"""

    type: str  # 'text', 'table', 'formula', 'figure'
    content: str
    bbox: tuple[float, float, float, float]  # x0, y0, x1, y1
    page_num: int
    needs_llm: bool = False
    block_id: str | None = None  # Unique ID for batch processing


class HybridPDFConverter:
    """
    LLM-based PDF converter using litellm.batch_completion() for instant
    parallel processing

    """

    def __init__(  # noqa: PLR0913
        self,
        model: str | None = None,
        api_base: str | None = None,
        custom_llm_provider: str | None = None,
        *,
        use_layout_mode: bool = True,
        debug_images: bool = False,
        ocr_prompt: str | None = None,
    ):
        """
        Args:
            model: Model to use (from settings.PDF_TRANSCRIPTION_MODEL
                if not provided)
            api_base: API base URL (from settings.LITELLM_API_BASE
                if not provided)
            custom_llm_provider: Provider (from
                settings.LITELLM_CUSTOM_PROVIDER if not provided)
            use_layout_mode: Use layout-preserving extraction
            debug_images: Save screenshot images for debugging
            ocr_prompt: Custom OCR prompt (from settings.IMAGE_OCR_PROMPT
                if not provided)
        """
        self.model = model or settings.PDF_TRANSCRIPTION_MODEL
        self.api_base = api_base or getattr(settings, "LITELLM_API_BASE", None)
        self.custom_llm_provider = custom_llm_provider or getattr(
            settings, "LITELLM_CUSTOM_PROVIDER", None
        )
        self.use_layout_mode = use_layout_mode
        self.debug_images = debug_images
        default_prompt = (
            "Extract all text from this image, preserving structure. "
            "For tables, use markdown format. For formulas, use LaTeX "
            "notation."
        )
        self.ocr_prompt = ocr_prompt or getattr(
            settings,
            "IMAGE_OCR_PROMPT",
            default_prompt,
        )

        if debug_images:
            Path("image_snapshots").mkdir(parents=True, exist_ok=True)

    def detect_formulas(self, text: str) -> bool:
        """Detect if text block likely contains mathematical formulas or LaTeX"""
        formula_patterns = [
            r"\$.*?\$",
            r"\\begin\{equation\}",
            r"\\begin\{align",
            r"\\frac",
            r"\\sum",
            r"\\int",
            r"\\sqrt",
            r"[∫∑∏√±≤≥≠∞]",
            r"\b[a-z]\s*=\s*[^,]+",
        ]
        return any(re.search(pattern, text) for pattern in formula_patterns)

    def extract_text_blocks(self, page: fitz.Page) -> list[ContentBlock]:
        """Extract text blocks with layout information"""
        blocks = []
        page_rect = page.rect

        if self.use_layout_mode:
            text_dict = page.get_text("dict")
            for block in text_dict.get("blocks", []):
                if block["type"] != 0:
                    continue

                bbox = block["bbox"]
                block_rect = fitz.Rect(bbox)

                # Validate block is within page bounds
                is_valid = page_rect.contains(block_rect) or page_rect.intersects(
                    block_rect
                )
                if not is_valid:
                    continue
                if block_rect.width < 1 or block_rect.height < 1:
                    continue

                # Extract text content
                text_content = self._extract_text_from_block(block)
                if not text_content:
                    continue

                needs_llm = self.detect_formulas(text_content)
                block_type = "formula" if needs_llm else "text"

                blocks.append(
                    ContentBlock(
                        type=block_type,
                        content=text_content,
                        bbox=bbox,
                        page_num=page.number,
                        needs_llm=needs_llm,
                    )
                )
        else:
            blocks = self._extract_simple_text_blocks(page)

        return blocks

    def _extract_text_from_block(self, block: dict) -> str:
        """Extract and clean text from a block dictionary"""
        text_content = ""
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                text_content += span["text"]
            text_content += "\n"
        return text_content.strip()

    def _extract_simple_text_blocks(self, page: fitz.Page) -> list[ContentBlock]:
        """Extract text blocks without layout preservation"""
        blocks = []
        text_blocks = page.get_text("blocks")

        for block in text_blocks:
            bbox = block[:4]
            text = block[4].strip()

            if not text:
                continue

            needs_llm = self.detect_formulas(text)
            block_type = "formula" if needs_llm else "text"

            blocks.append(
                ContentBlock(
                    type=block_type,
                    content=text,
                    bbox=bbox,
                    page_num=page.number,
                    needs_llm=needs_llm,
                )
            )

        return blocks

    def detect_tables(self, pdf_path: str, page_num: int) -> list[ContentBlock]:
        """Detect tables on a page using pdfplumber"""
        tables = []
        try:
            with pdfplumber.open(pdf_path) as pdf:
                if page_num >= len(pdf.pages):
                    return tables

                page = pdf.pages[page_num]
                detected_tables = page.find_tables()

                for table in detected_tables:
                    bbox = table.bbox
                    tables.append(
                        ContentBlock(
                            type="table",
                            content="",
                            bbox=bbox,
                            page_num=page_num,
                            needs_llm=True,
                        )
                    )
        except (OSError, ValueError) as e:
            log.warning("Table detection failed on page %s: %s", page_num, e)

        return tables

    def extract_figures(self, page: fitz.Page) -> list[ContentBlock]:
        """Extract images/figures from page"""
        figures = []
        image_list = page.get_images(full=True)

        for img_info in image_list:
            try:
                bbox = page.get_image_bbox(img_info)

                is_too_small = (
                    bbox.is_empty
                    or bbox.width < MIN_IMAGE_SIZE
                    or bbox.height < MIN_IMAGE_SIZE
                )
                if is_too_small:
                    continue

                figures.append(
                    ContentBlock(
                        type="figure",
                        content="",
                        bbox=(bbox.x0, bbox.y0, bbox.x1, bbox.y1),
                        page_num=page.number,
                        needs_llm=True,
                    )
                )
            except (ValueError, RuntimeError) as e:
                log.warning(
                    "Could not process image on page %s: %s",
                    page.number,
                    e,
                )

        return figures

    def extract_image_region(self, page: fitz.Page, bbox: tuple) -> bytes:
        """Extract specific region of page as PNG image"""
        mat = fitz.Matrix(2.0, 2.0)
        rect = fitz.Rect(bbox)
        pix = page.get_pixmap(matrix=mat, clip=rect)
        return pix.tobytes("png")

    def boxes_overlap(
        self, box1: tuple, box2: tuple, threshold: float = OVERLAP_THRESHOLD
    ) -> bool:
        """Check if two bounding boxes overlap significantly"""
        x0_1, y0_1, x1_1, y1_1 = box1
        x0_2, y0_2, x1_2, y1_2 = box2

        x_overlap = max(0, min(x1_1, x1_2) - max(x0_1, x0_2))
        y_overlap = max(0, min(y1_1, y1_2) - max(y0_1, y0_2))
        intersection = x_overlap * y_overlap

        area1 = (x1_1 - x0_1) * (y1_1 - y0_1)
        area2 = (x1_2 - x0_2) * (y1_2 - y0_2)

        if area1 == 0 or area2 == 0:
            return False

        overlap_ratio = intersection / min(area1, area2)
        return overlap_ratio > threshold

    def merge_overlapping_blocks(
        self, blocks: list[ContentBlock]
    ) -> list[ContentBlock]:
        """Remove overlapping blocks, prioritizing tables > figures > formulas > text"""
        priority_order = {"table": 3, "figure": 2, "formula": 1, "text": 0}

        sorted_blocks = sorted(
            blocks, key=lambda b: priority_order[b.type], reverse=True
        )

        final_blocks = []
        for block in sorted_blocks:
            overlaps = any(
                self.boxes_overlap(block.bbox, existing.bbox)
                for existing in final_blocks
            )

            if not overlaps:
                final_blocks.append(block)

        final_blocks.sort(key=lambda b: (b.page_num, b.bbox[1], b.bbox[0]))
        return final_blocks

    def prepare_batch_messages(
        self, doc: fitz.Document, blocks: list[ContentBlock]
    ) -> tuple[list[list[dict]], dict[int, ContentBlock]]:
        """
        Prepare messages for batch_completion()

        Returns:
            messages_list: List of message arrays for batch_completion
            block_map: Mapping of index to ContentBlock for reconstruction
        """
        messages_list = []
        block_map = {}
        idx = 0

        for i, block in enumerate(blocks):
            if not block.needs_llm:
                continue

            # Generate unique ID for this block
            block.block_id = f"block_{block.page_num}_{i}"
            block_map[idx] = block

            # Extract image region
            page = doc[block.page_num]
            img_bytes = self.extract_image_region(page, block.bbox)
            pil_image = Image.open(BytesIO(img_bytes)).convert("RGB")

            # Optimize image size
            if max(pil_image.size) > MAX_IMAGE_SIZE:
                pil_image.thumbnail(
                    (MAX_IMAGE_SIZE, MAX_IMAGE_SIZE), Image.Resampling.LANCZOS
                )

            # Save debug image if enabled
            if self.debug_images:
                self._save_debug_image(pil_image, block, i)

            # Convert to base64
            image_b64 = self._image_to_base64(pil_image)

            # Create message for this image
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": self.ocr_prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"},
                        },
                    ],
                }
            ]

            messages_list.append(messages)
            idx += 1

        return messages_list, block_map

    def _save_debug_image(
        self, pil_image: Image.Image, block: ContentBlock, idx: int
    ) -> None:
        """Save a debug image to disk"""
        timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S_%f")
        filename = (
            f"image_snapshots/{block.type}_p{block.page_num}_b{idx}_{timestamp}.png"
        )
        pil_image.save(filename)
        log.debug("Saved debug image: %s", filename)

    def _image_to_base64(self, pil_image: Image.Image) -> str:
        """Convert PIL image to base64 string"""
        buffer = BytesIO()
        pil_image.save(buffer, format="JPEG", optimize=True)
        return base64.b64encode(buffer.getvalue()).decode("utf-8")

    def process_batch(self, messages_list: list[list[dict]]) -> list[str]:
        """
        Process all messages using litellm.batch_completion()

        Returns:
            List of OCR results in same order as messages_list
        """
        if not messages_list:
            return []

        log.info(
            "Processing %s images with batch_completion...",
            len(messages_list),
        )

        # Build kwargs for batch_completion
        kwargs = {
            "model": self.model,
            "messages": messages_list,
            "max_tokens": 4000,
        }

        # Add optional parameters if set
        if self.api_base:
            kwargs["api_base"] = self.api_base
        if self.custom_llm_provider:
            kwargs["custom_llm_provider"] = self.custom_llm_provider

        try:
            # Call batch_completion - sends all requests at once!
            responses = batch_completion(**kwargs)

            # Extract text from responses
            results = []
            for response in responses:
                try:
                    content = response.choices[0].message.content
                    results.append(content)
                except (AttributeError, IndexError):
                    log.exception("Failed to extract content from response")
                    results.append("")

            log.info("Successfully processed %s images", len(results))
        except Exception:
            log.exception("Batch completion failed")
            raise
        else:
            return results

    def convert_to_markdown(self, pdf_path: str) -> str:
        """
        Convert PDF to markdown using batch_completion

        Args:
            pdf_path: Path to PDF file

        Returns:
            Markdown string
        """
        doc = fitz.open(pdf_path)
        all_blocks = []

        # First pass: Extract all blocks
        separator = "=" * 60
        log.info(separator)
        log.info("Extracting blocks from PDF...")
        log.info(separator)

        for page_num in range(len(doc)):
            page = doc[page_num]
            log.info("Processing page %s/%s", page_num + 1, len(doc))

            text_blocks = self.extract_text_blocks(page)
            table_blocks = self.detect_tables(pdf_path, page_num)
            figure_blocks = self.extract_figures(page)

            page_blocks = text_blocks + table_blocks + figure_blocks
            page_blocks = self.merge_overlapping_blocks(page_blocks)

            log.info("  Found %s blocks", len(page_blocks))
            all_blocks.extend(page_blocks)

        # Prepare batch messages
        log.info("\n%s", separator)
        log.info("Preparing batch messages...")
        log.info(separator)

        messages_list, block_map = self.prepare_batch_messages(doc, all_blocks)
        llm_blocks_count = len(messages_list)
        text_blocks_count = len(all_blocks) - llm_blocks_count

        log.info("Total blocks: %s", len(all_blocks))
        log.info("  Direct text extraction: %s", text_blocks_count)
        log.info("  LLM processing needed: %s", llm_blocks_count)

        if llm_blocks_count == 0:
            log.info("No LLM processing needed, building markdown directly...")
            doc.close()
            return self._build_markdown_from_blocks(all_blocks, {})

        # Process all images at once with batch_completion
        log.info("\n%s", separator)
        log.info("Processing all images with batch_completion...")
        log.info(separator)

        results = self.process_batch(messages_list)

        # Map results back to blocks
        results_map = {}
        for idx, result in enumerate(results):
            if idx in block_map:
                block = block_map[idx]
                results_map[block.block_id] = result

        doc.close()

        # Build markdown
        log.info("\n%s", separator)
        log.info("Building final markdown...")
        log.info(separator)
        return self._build_markdown_from_blocks(all_blocks, results_map)

    def _build_markdown_from_blocks(
        self, blocks: list[ContentBlock], results_map: dict[str, str]
    ) -> str:
        """Build markdown from blocks and LLM results"""
        markdown_parts = []

        for block in blocks:
            if block.needs_llm:
                if block.block_id in results_map:
                    markdown_parts.append(results_map[block.block_id])
                else:
                    log.warning("Missing result for block %s", block.block_id)
            else:
                markdown_parts.append(block.content)

            markdown_parts.append("\n\n")

        return "".join(markdown_parts).strip()
