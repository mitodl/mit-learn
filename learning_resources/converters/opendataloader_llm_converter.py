"""
PDF to Markdown converter using OpenDataLoader JSON output and LLM-based OCR.

This module provides a converter that:
1. Uses opendataloader_pdf to convert PDFs to structured JSON
2. Extracts images from PDF pages based on bounding box coordinates
3. Processes images through an LLM for OCR/description
4. Assembles the final markdown from structured content
"""

import base64
import gc
import json
import logging
import tempfile
import uuid
from dataclasses import dataclass
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

MIN_IMAGE_DIMENSION = 32
MIN_IMAGE_RATIO = 12
IMAGE_BATCH_SIZE = 5
PDF_POINTS_PER_INCH = 72


@dataclass
class ContentBlock:
    """A content block from the PDF structure."""

    block_type: str
    block_id: int
    page_number: int
    bounding_box: list[float]
    content: str | None = None
    heading_level: int | None = None


@dataclass
class ImageForOCR:
    """An image extracted from PDF that needs OCR processing."""

    block_id: int
    pil_image: Image.Image


def _optimize_image(pil_image: Image.Image) -> Image.Image:
    """
    Optimize an image for OCR by reducing filesize and denoising.

    Uses different optimization strategies based on image complexity:
    - Color-sensitive optimization for charts and complex tables
    - Binarization for text, formulas, and handwriting
    """
    np_image = np.array(pil_image.convert("RGB"))
    unique_colors = len(np.unique(np_image.reshape(-1, 3), axis=0))
    color_threshold = 200

    if unique_colors > color_threshold:
        return _optimize_color_image(np_image)
    return _optimize_text_image(np_image)


def _optimize_color_image(np_image: np.ndarray) -> Image.Image:
    """Apply optimization for color-rich images like charts."""
    processed = cv2.cvtColor(np_image, cv2.COLOR_RGB2GRAY)
    processed = cv2.GaussianBlur(processed, (3, 3), 0)
    return Image.fromarray(processed)


def _optimize_text_image(np_image: np.ndarray) -> Image.Image:
    """Apply optimization for text, formulas, and handwriting."""
    gray = cv2.cvtColor(np_image, cv2.COLOR_RGB2GRAY)
    _, processed = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return Image.fromarray(processed)


def _image_to_base64_uri(pil_image: Image.Image) -> str:
    """Convert a PIL image to a base64 data URI."""
    buffer = BytesIO()
    pil_image.save(buffer, format="JPEG", optimize=True)
    image_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/jpeg;base64,{image_b64}"


def _build_ocr_message(image_uri: str, prompt: str) -> list[dict]:
    """Build the message payload for OCR API call."""
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
    aspect_ratio = max(width / max(height, 1), height / max(width, 1))
    return aspect_ratio <= MIN_IMAGE_RATIO


def _parse_heading_level(block_data: dict[str, Any]) -> int:
    """Extract heading level from block data, defaulting to 1."""
    level_value = block_data.get("heading level") or block_data.get("level", 1)
    if isinstance(level_value, int):
        return level_value
    if isinstance(level_value, str) and level_value.isdigit():
        return int(level_value)
    return 1


def _parse_content_block(block_data: dict[str, Any]) -> ContentBlock:
    """Parse a single content block from the JSON structure."""
    block_type = block_data.get("type", "unknown")
    heading_level = (
        _parse_heading_level(block_data) if block_type == "heading" else None
    )

    return ContentBlock(
        block_type=block_type,
        block_id=block_data.get("id", 0),
        page_number=block_data.get("page number", 1),
        bounding_box=block_data.get("bounding box", [0, 0, 0, 0]),
        content=block_data.get("content"),
        heading_level=heading_level,
    )


class PDFPageRenderer:
    """Handles rendering PDF pages and extracting image regions."""

    def __init__(self, document_path: Path, dpi: int = 150):
        self.document_path = document_path
        self.dpi = dpi
        self._page_cache: dict[int, Image.Image] = {}
        self._scale = dpi / PDF_POINTS_PER_INCH

    def get_page_image(self, page_number: int) -> Image.Image:
        """Get or render a page image (1-indexed page numbers)."""
        if page_number not in self._page_cache:
            images = pdf2image.convert_from_path(
                self.document_path,
                dpi=self.dpi,
                first_page=page_number,
                last_page=page_number,
            )
            self._page_cache[page_number] = images[0]
        return self._page_cache[page_number]

    def extract_region(self, page_number: int, bbox: list[float]) -> Image.Image | None:
        """
        Extract an image region from a PDF page using bounding box coordinates.

        PDF coordinates: origin at bottom-left, y increases upward.
        PIL coordinates: origin at top-left, y increases downward.
        """
        page_image = self.get_page_image(page_number)
        page_width, page_height = page_image.size

        crop_coords = self._convert_bbox_to_pixels(bbox, page_width, page_height)
        if crop_coords is None:
            return None

        return page_image.crop(crop_coords)

    def _convert_bbox_to_pixels(
        self, bbox: list[float], page_width: int, page_height: int
    ) -> tuple[int, int, int, int] | None:
        """Convert PDF bbox to PIL crop coordinates, returning None if invalid."""
        pdf_x1, pdf_y1, pdf_x2, pdf_y2 = bbox

        # Convert PDF points to pixels and flip y-axis
        pil_x1 = int(pdf_x1 * self._scale)
        pil_x2 = int(pdf_x2 * self._scale)
        pil_y1 = int(page_height - pdf_y2 * self._scale)
        pil_y2 = int(page_height - pdf_y1 * self._scale)

        # Clamp to page bounds
        pil_x1 = max(0, min(pil_x1, page_width))
        pil_x2 = max(0, min(pil_x2, page_width))
        pil_y1 = max(0, min(pil_y1, page_height))
        pil_y2 = max(0, min(pil_y2, page_height))

        width = pil_x2 - pil_x1
        height = pil_y2 - pil_y1

        if not _is_valid_image_dimensions(width, height):
            return None

        return (pil_x1, pil_y1, pil_x2, pil_y2)

    def cleanup(self) -> None:
        """Close all cached page images to free memory."""
        for page_image in self._page_cache.values():
            page_image.close()
        self._page_cache.clear()


class OCRProcessor:
    """Handles batch OCR processing of images via LLM."""

    def __init__(self, batch_size: int = IMAGE_BATCH_SIZE):
        self.batch_size = batch_size

    def process_images(self, images: list[ImageForOCR]) -> dict[int, str]:
        """Process images and return mapping of block_id to OCR text."""
        if not images:
            log.info("No images to process for OCR")
            return {}

        block_ids = [img.block_id for img in images]
        messages = self._prepare_messages(images)
        ocr_texts = self._execute_batch_ocr(messages)

        return dict(zip(block_ids, ocr_texts, strict=True))

    def _prepare_messages(self, images: list[ImageForOCR]) -> list[list[dict]]:
        """Convert images to OCR API message format."""
        messages = []
        for img in images:
            image_uri = _image_to_base64_uri(img.pil_image)
            img.pil_image.close()
            messages.append(_build_ocr_message(image_uri, settings.OCR_PROMPT))
        return messages

    def _execute_batch_ocr(self, messages_list: list[list[dict]]) -> list[str]:
        """Execute batch OCR API calls in chunks to manage memory."""
        all_texts = []
        total = len(messages_list)

        for i in range(0, total, self.batch_size):
            batch = messages_list[i : i + self.batch_size]
            responses = batch_completion(
                custom_llm_provider=settings.LITELLM_CUSTOM_PROVIDER,
                api_base=settings.LITELLM_API_BASE,
                model=settings.OCR_MODEL,
                messages=batch,
            )
            batch_texts = [resp.choices[0].message.content for resp in responses]
            all_texts.extend(batch_texts)

            end_idx = min(i + self.batch_size, total)
            log.info("Processed OCR batch %d-%d of %d images", i + 1, end_idx, total)
            gc.collect()

        return all_texts


class MarkdownAssembler:
    """Assembles markdown from content blocks and OCR results."""

    def assemble(self, blocks: list[ContentBlock], ocr_results: dict[int, str]) -> str:
        """Assemble final markdown from content blocks and OCR results."""
        formatted_parts = [
            formatted
            for block in blocks
            if (formatted := self._format_block(block, ocr_results)) is not None
        ]
        return "\n\n".join(formatted_parts)

    def _format_block(
        self, block: ContentBlock, ocr_results: dict[int, str]
    ) -> str | None:
        """Format a single content block for markdown output."""
        if block.block_type == "heading" and block.content:
            level = min(block.heading_level or 1, 6)
            return f"{'#' * level} {block.content}"

        if block.block_type == "paragraph" and block.content:
            return block.content

        if block.block_type == "image":
            return ocr_results.get(block.block_id)

        return None


class OpenDataLoaderLLMConverter:
    """Convert PDFs to markdown using OpenDataLoader JSON and LLM-based OCR."""

    def __init__(
        self,
        document_path: Path,
        debug_mode,
        output_dir: Path | None = None,
        image_batch_size: int = IMAGE_BATCH_SIZE,
        pdf_dpi: int = 150,
    ):
        self.document_path = Path(document_path)
        self.debug_mode = debug_mode
        self._tempdir = tempfile.TemporaryDirectory()
        self.output_dir = output_dir or Path(self._tempdir.name)
        self._page_renderer = PDFPageRenderer(self.document_path, dpi=pdf_dpi)
        self._ocr_processor = OCRProcessor(batch_size=image_batch_size)
        self._markdown_assembler = MarkdownAssembler()

        if debug_mode:
            litellm._turn_on_debug()  # noqa: SLF001

    @property
    def _debug_dir(self) -> Path:
        """Get or create the debug output directory."""
        debug_dir = Path(settings.OCR_DEBUG_DIRECTORY) / self.document_path.stem
        debug_dir.mkdir(parents=True, exist_ok=True)
        return debug_dir

    def _save_debug_image(self, pil_image: Image.Image) -> str:
        """Save an image for debugging purposes."""
        file_path = self._debug_dir / f"{self.document_path.name}-{uuid.uuid4()}.png"
        pil_image.save(file_path)
        return str(file_path)

    def _save_debug_markdown(self, markdown_content: str) -> str:
        """Save markdown content for debugging purposes."""
        file_path = self._debug_dir / f"{self.document_path.name}.md"
        file_path.write_text(markdown_content)
        return str(file_path)

    def _convert_pdf_to_json(self) -> dict[str, Any]:
        """Convert PDF to JSON structure using opendataloader."""
        self.output_dir.mkdir(parents=True, exist_ok=True)

        opendataloader_pdf.convert(
            input_path=[str(self.document_path)],
            output_dir=str(self.output_dir),
            format="json",
            use_struct_tree=True,
            keep_line_breaks=True,
        )

        json_path = self.output_dir / f"{self.document_path.stem}.json"
        return json.loads(json_path.read_text())

    def _parse_document_structure(
        self, json_data: dict[str, Any]
    ) -> list[ContentBlock]:
        """Parse the JSON document structure into content blocks."""
        kids = json_data.get("kids", [])
        return [_parse_content_block(kid) for kid in kids]

    def _collect_images_for_ocr(self, blocks: list[ContentBlock]) -> list[ImageForOCR]:
        """Extract and optimize all valid images from content blocks."""
        image_blocks = [b for b in blocks if b.block_type == "image"]
        images_for_ocr = []

        for block in image_blocks:
            image = self._extract_and_optimize_image(block)
            if image is not None:
                images_for_ocr.append(
                    ImageForOCR(block_id=block.block_id, pil_image=image)
                )

        return images_for_ocr

    def _extract_and_optimize_image(self, block: ContentBlock) -> Image.Image | None:
        """Extract image region from PDF and optimize for OCR."""
        cropped = self._page_renderer.extract_region(
            block.page_number, block.bounding_box
        )
        if cropped is None:
            log.debug("Skipping invalid image region for block %d", block.block_id)
            return None

        optimized = _optimize_image(cropped)
        cropped.close()

        if self.debug_mode:
            self._save_debug_image(optimized)

        return optimized

    def convert_to_markdown(self) -> str:
        """
        Convert the PDF document to markdown with OCR'd images.

        Returns:
            The final markdown content with all images processed.
        """
        try:
            json_data = self._convert_pdf_to_json()
            blocks = self._parse_document_structure(json_data)
            images = self._collect_images_for_ocr(blocks)
            ocr_results = self._ocr_processor.process_images(images)
            final_markdown = self._markdown_assembler.assemble(blocks, ocr_results)

            if self.debug_mode:
                self._save_debug_markdown(final_markdown)

            return final_markdown
        finally:
            self._page_renderer.cleanup()
