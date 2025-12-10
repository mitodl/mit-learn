"""
PDF to Markdown converter using OpenDataLoader and LLM-based OCR.

This module provides a converter that:
1. Uses opendataloader_pdf to convert PDFs to markdown with extracted images
2. Processes embedded images through an LLM for OCR/description
3. Stitches the OCR results back into the final markdown
"""

import base64
import gc
import logging
import re
import tempfile
import uuid
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

import cv2
import litellm
import numpy as np
import opendataloader_pdf
from django.conf import settings
from litellm import batch_completion
from PIL import Image

log = logging.getLogger(__name__)

MIN_IMAGE_DIMENSION = 64
MIN_IMAGE_RATIO = 12
IMAGE_PATTERN = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")

# Process images in batches to avoid memory issues with large documents
IMAGE_BATCH_SIZE = 5


@dataclass
class ImageReference:
    """Image found in markdown."""

    alt_text: str
    path: str
    full_match: str


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
    processed_image = cv2.cvtColor(np_image, cv2.COLOR_RGB2GRAY)
    processed_image = cv2.GaussianBlur(processed_image, (3, 3), 0)
    return Image.fromarray(processed_image)


def _optimize_text_image(np_image: np.ndarray) -> Image.Image:
    """Apply optimization for text, formulas, and handwriting."""
    gray_image = cv2.cvtColor(np_image, cv2.COLOR_RGB2GRAY)
    denoised_image = cv2.medianBlur(gray_image, 3)
    _, processed_image = cv2.threshold(
        denoised_image, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU
    )
    return Image.fromarray(processed_image)


def _image_to_base64_uri(pil_image: Image.Image) -> str:
    """Convert a PIL image to a base64 data URI."""
    buffer = BytesIO()
    pil_image.save(buffer, format="JPEG", optimize=True)
    image_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/jpeg;base64,{image_b64}"


def _extract_image_references(markdown_content: str) -> list[ImageReference]:
    """Extract all image references from markdown content."""
    matches = IMAGE_PATTERN.findall(markdown_content)
    return [
        ImageReference(alt_text=alt, path=path, full_match=f"![{alt}]({path})")
        for alt, path in matches
    ]


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


class OpenDataLoaderLLMConverter:
    """
    Convert pdfs to markdown using OpenDataLoader and LLM-based OCR.
    """

    def __init__(
        self,
        document_path: Path,
        debug_mode,
        output_dir: Path | None = None,
        image_batch_size: int = IMAGE_BATCH_SIZE,
    ):
        self.document_path = Path(document_path)
        self.debug_mode = debug_mode
        self.tempdir = tempfile.TemporaryDirectory()
        self.output_dir = output_dir or Path(self.tempdir.name)
        self.image_batch_size = image_batch_size

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

    def _convert_pdf_to_markdown(self) -> tuple[str, Path]:
        """
        Convert PDF to markdown using opendataloader.

        Returns:
            Tuple of (markdown_content, images_directory_path)
        """
        self.output_dir.mkdir(parents=True, exist_ok=True)

        opendataloader_pdf.convert(
            input_path=[str(self.document_path)],
            output_dir=str(self.output_dir),
            format="markdown-with-images",
            keep_line_breaks=True,
            use_struct_tree=True,
        )

        markdown_path = self.output_dir / f"{self.document_path.stem}.md"
        images_dir = self.output_dir / f"{self.document_path.stem}_images"

        markdown_content = markdown_path.read_text()
        return markdown_content, images_dir

    def _load_and_optimize_image(self, image_path: Path) -> Image.Image | None:
        """Load an image from disk and optimize it for OCR."""
        pil_image = None
        try:
            pil_image = Image.open(image_path)
            # Drop tiny pixel images
            cw, ch = pil_image.size
            # Skip weird tiny strips or lines
            if cw < MIN_IMAGE_DIMENSION or ch < MIN_IMAGE_DIMENSION:
                return None
            # Skip extreme aspect ratios (like lines)
            ratio = max(cw / max(ch, 1), ch / max(cw, 1))
            if ratio > MIN_IMAGE_RATIO:  # extremely long thin strip
                return None
            # Load image data into memory so we can close the file handle
            pil_image.load()
            optimized = _optimize_image(pil_image)
            if self.debug_mode:
                self._save_debug_image(optimized)
            return optimized  # noqa: TRY300
        except Exception:
            log.exception("Failed to load image: %s", image_path)
            return None
        finally:
            # Ensure original image is closed to free memory
            if pil_image is not None:
                pil_image.close()

    def _resolve_image_path(self, ref_path: str, images_dir: Path) -> Path:
        """
        Resolve an image reference path to an absolute path.

        Handles both absolute paths and relative paths.
        """
        ref_path_obj = Path(ref_path)
        if ref_path_obj.is_absolute() and ref_path_obj.exists():
            return ref_path_obj

        # Try relative to images directory
        potential_path = images_dir / ref_path_obj.name
        if potential_path.exists():
            return potential_path

        # Try the path as-is from output directory
        potential_path = self.output_dir / ref_path_obj.name
        if potential_path.exists():
            return potential_path

        return ref_path_obj

    def _prepare_image_message(
        self, ref: ImageReference, images_dir: Path
    ) -> list[dict] | None:
        """
        Prepare OCR message for a single image.

        Returns None if image cannot be loaded or processed.
        """
        image_path = self._resolve_image_path(ref.path, images_dir)
        optimized_image = self._load_and_optimize_image(image_path)

        if optimized_image is None:
            log.warning("Skipping image reference: %s", ref.path)
            return None

        image_uri = _image_to_base64_uri(optimized_image)
        # Explicitly close image to free memory
        optimized_image.close()

        return _build_ocr_message(image_uri, settings.OCR_PROMPT)

    def _prepare_batch_messages(
        self, image_refs: list[ImageReference], images_dir: Path
    ) -> tuple[list[ImageReference], list[list[dict]]]:
        """
        Prepare batch OCR messages for all valid images.

        Returns:
            Tuple of (valid_refs, messages_list) where valid_refs are references
            with successfully loaded images
        """
        valid_refs = []
        messages_list = []

        for ref in image_refs:
            messages = self._prepare_image_message(ref, images_dir)
            if messages is not None:
                messages_list.append(messages)
                valid_refs.append(ref)

        return valid_refs, messages_list

    def _execute_batch_ocr(self, messages_list: list[list[dict]]) -> list[str]:
        """Execute batch OCR API calls in chunks to manage memory."""
        if not messages_list:
            return []

        all_texts = []
        for i in range(0, len(messages_list), self.image_batch_size):
            batch = messages_list[i : i + self.image_batch_size]
            responses = batch_completion(
                custom_llm_provider=settings.LITELLM_CUSTOM_PROVIDER,
                api_base=settings.LITELLM_API_BASE,
                model=settings.OCR_MODEL,
                messages=batch,
            )
            batch_texts = [resp.choices[0].message.content for resp in responses]
            all_texts.extend(batch_texts)
            log.info(
                "Processed OCR batch %d-%d of %d images",
                i + 1,
                min(i + self.image_batch_size, len(messages_list)),
                len(messages_list),
            )
            # Force garbage collection after each batch to manage memory
            gc.collect()

        return all_texts

    def _replace_images_with_text(
        self,
        markdown_content: str,
        image_refs: list[ImageReference],
        extracted_texts: list[str],
    ) -> str:
        """Replace image references in markdown with extracted text."""
        result = markdown_content
        for ref, text in zip(image_refs, extracted_texts, strict=True):
            result = result.replace(ref.full_match, text)
        return result

    def _process_images(self, markdown_content: str, images_dir: Path) -> str:
        """
        Process all images in the markdown and replace with OCR text.

        Args:
            markdown_content: The markdown content with image references
            images_dir: Directory containing the extracted images

        Returns:
            Markdown content with images replaced by OCR text
        """
        image_refs = _extract_image_references(markdown_content)

        if not image_refs:
            log.info("No images found in markdown")
            return markdown_content

        valid_refs, messages_list = self._prepare_batch_messages(image_refs, images_dir)

        if not messages_list:
            log.warning("No valid images to process")
            return markdown_content

        extracted_texts = self._execute_batch_ocr(messages_list)
        return self._replace_images_with_text(
            markdown_content, valid_refs, extracted_texts
        )

    def convert_to_markdown(self) -> str:
        """
        Convert the PDF document to markdown with OCR'd images.

        Returns:
            The final markdown content with all images processed
        """
        markdown_content, images_dir = self._convert_pdf_to_markdown()
        final_markdown = self._process_images(markdown_content, images_dir)

        if self.debug_mode:
            self._save_debug_markdown(final_markdown)

        return final_markdown
