import base64
import logging
import uuid
from io import BytesIO
from pathlib import Path

import litellm
from django.conf import settings
from docling.backend.docling_parse_v4_backend import DoclingParseV4DocumentBackend
from docling.datamodel.base_models import DocumentStream, InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling_core.types.doc import (
    BoundingBox,
    DocItemLabel,
    DoclingDocument,
    FormulaItem,
    PictureItem,
    ProvenanceItem,
    TableItem,
)
from litellm import batch_completion, completion
from PIL import Image

log = logging.getLogger(__name__)


def _page_item_to_pil(page, item, expand_px: int = 10) -> Image.Image | None:
    """
    Given a Docling document and an item (e.g. FormulaItem), return a PIL Image
    cropped to that item's bbox on the corresponding page image.

    - If the item already has an image attribute, return it.
    - Otherwise, use item.prov[0] (or item.bbox) to find bbox
    - expand_px: small pixel padding to add around the crop.
    - Returns None on failure.
    """
    page_no = page.page_no
    x0, y0, x1, y1 = item.prov[0].bbox.as_tuple()
    page_pil = page.image.pil_image
    page_size = page.size

    page_w_units, page_h_units = float(page_size.width), float(page_size.height)

    # If page_w_units or page_h_units are zero, avoid divide-by-zero
    if page_w_units == 0 or page_h_units == 0:
        page_w_units, page_h_units = page_pil.width, page_pil.height

    # scale factors (units -> pixels)
    sx = page_pil.width / page_w_units
    sy = page_pil.height / page_h_units

    """
    PDF coordinates usually have origin bottom-left; PIL has top-left.
    We will assume prov.bbox uses PDF coordinates: y grows up.
    Convert accordingly: y_pixel = img_h - (y_unit * sy)
    """
    px_x0 = round(x0 * sx)
    px_x1 = round(x1 * sx)

    """
    convert y: prov y0,y1 might be bottom-left-based or
    top-left-based depending on backend.
    Best heuristic: if bbox coordinates are small relative to
    page height it's probably bottom-left.
    We'll convert using PDF->PIL convention:
    """
    px_y1 = round(page_pil.height - (y0 * sy))  # bottom -> y1 in pixels
    px_y0 = round(page_pil.height - (y1 * sy))  # top -> y0 in pixels

    # normalize to left/top/right/bottom
    left = min(px_x0, px_x1)
    right = max(px_x0, px_x1)
    top = min(px_y0, px_y1)
    bottom = max(px_y0, px_y1)

    # apply small padding, clamp to image
    left = max(0, left - expand_px)
    top = max(0, top - expand_px)
    right = min(page_pil.width, right + expand_px)
    bottom = min(page_pil.height, bottom + expand_px)

    if left >= right or top >= bottom:
        log.debug(
            "Empty crop area for item on page %s: %s",
            page_no,
            (left, top, right, bottom),
        )
        return None
    try:
        return page_pil.crop((left, top, right, bottom))
    except Exception:
        log.exception("Failed to crop page image for item")
        return None


class DoclingLLMConverter:
    debug_mode = False

    def __init__(self, document_path: Path, debug_mode, *args, **kwargs):  # noqa: ARG002
        if debug_mode:
            litellm._turn_on_debug()  # noqa: SLF001
        self.debug_mode = debug_mode
        self.document_path = document_path
        self.pipeline_options = self.get_pipeline_options()
        self.converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(
                    backend=DoclingParseV4DocumentBackend,
                    pipeline_options=self.pipeline_options,
                ),
            }
        )

    def get_pipeline_options(self):
        pipeline_options = PdfPipelineOptions()
        pipeline_options.images_scale = 2

        pipeline_options.do_picture_description = False
        pipeline_options.do_code_enrichment = False
        pipeline_options.do_picture_classification = False
        pipeline_options.do_ocr = False
        pipeline_options.do_formula_enrichment = False
        pipeline_options.do_table_structure = False

        pipeline_options.generate_page_images = True
        pipeline_options.generate_picture_images = True
        pipeline_options.generate_table_images = True

        return pipeline_options

    def items_by_page(self, doc: DoclingDocument):
        """
        Return docling doc items by page
        """
        all_items = [i[0] for i in list(doc.iterate_items())]
        for page in doc.pages.values():
            page_number = page.page_no
            # Extract items belonging to this page
            page_items = [
                item for item in all_items if item.prov[0].page_no == page_number
            ]
            yield page, page_items

    def add_page_text(self, doc, page, text):
        # Construct a provenance entry that points to the whole page
        prov = ProvenanceItem(
            page_no=page.page_no,
            bbox=BoundingBox(t=0.0, b=0.0, l=0.0, r=0.0),
            charspan=[0, 0],
            uri=None,
        )
        return doc.add_text(
            label=DocItemLabel.TEXT,
            text=text,
            prov=prov,
        )

    def ocr_page_image(self, page):
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": settings.OCR_PROMPT},
                    {"type": "image_url", "image_url": {"url": str(page.image.uri)}},
                ],
            }
        ]
        response = completion(
            custom_llm_provider=settings.LITELLM_CUSTOM_PROVIDER,
            api_base=settings.LITELLM_API_BASE,
            model=settings.OCR_MODEL,
            messages=messages,
        )
        return response.json()["choices"][0]["message"]["content"]

    def save_debug_image(self, pil_image):
        debug_dir = Path("ocr_debug") / self.document_path.stem
        debug_dir.mkdir(parents=True, exist_ok=True)
        file_path = debug_dir / f"{self.document_path.name}-{uuid.uuid4()}.png"
        pil_image.save(file_path)
        return str(file_path)

    def save_debug_markdown(self, markdown_content):
        debug_dir = Path("ocr_debug") / self.document_path.stem
        debug_dir.mkdir(parents=True, exist_ok=True)
        file_path = debug_dir / f"{self.document_path.name}.md"
        file_path.write_text(markdown_content)
        return str(file_path)

    def transcribe_images(self, doc, page, items):
        replacements = []
        messages_list = []
        processed_items = []
        for item in items:
            if isinstance(item, (PictureItem, FormulaItem, TableItem)):
                buffer = BytesIO()
                pil_image = _page_item_to_pil(page, item)
                pil_image.save(buffer, format="JPEG", optimize=True)
                if self.debug_mode:
                    self.save_debug_image(pil_image)
                image_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
                image_uri = f"data:image/jpeg;base64,{image_b64}"
                messages_list.append(
                    [
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": settings.OCR_PROMPT},
                                {
                                    "type": "image_url",
                                    "image_url": {"url": image_uri},
                                },
                            ],
                        }
                    ]
                )
                processed_items.append(item)

        responses = batch_completion(
            custom_llm_provider=settings.LITELLM_CUSTOM_PROVIDER,
            api_base=settings.LITELLM_API_BASE,
            model=settings.OCR_MODEL,
            messages=messages_list,
        )
        for i in range(len(responses)):
            response = responses[i]
            item = processed_items[i]
            extracted_text = response.choices[0].message.content
            prov = item.prov[0] if isinstance(item.prov, list) and item.prov else None
            """
            preserve any captions the item has
            (sometimes these are visible on the page in place of headers)
            """
            if hasattr(item, "caption_text"):
                extracted_text = "\n".join([item.caption_text(doc), extracted_text])
            text_element = doc.add_text(
                label=DocItemLabel.TEXT,
                text=extracted_text,
                prov=prov,
            )
            replacements.append((item, text_element))
        return replacements

    def convert_to_markdown(self):
        file_buffer = BytesIO(self.document_path.open("rb").read())
        stream = DocumentStream(name=self.document_path.name, stream=file_buffer)
        conversion_result = self.converter.convert(stream)
        document = conversion_result.document

        for page, items in self.items_by_page(document):
            if len(items) > 0:
                replacements = self.transcribe_images(document, page, items)
                for old_item, new_item in replacements:
                    document.replace_item(new_item=new_item, old_item=old_item)
            else:
                transcribed = self.ocr_page_image(page)
                self.add_page_text(document, page, transcribed)
        # ref https://github.com/docling-project/docling/issues/2494#issuecomment-3418781668
        markdown_document = DoclingDocument(name="markdown")
        markdown_document.add_title(text="")
        for ref in document.body.children:
            node = ref.resolve(document)
            markdown_document.add_node_items([node], doc=document)
        markdown_content = markdown_document.export_to_markdown(
            image_mode="placeholder", include_annotations=True
        )
        if self.debug_mode:
            self.save_debug_markdown(markdown_content)
        return markdown_content
