import logging
from pathlib import Path

from django.conf import settings
from docling.backend.pypdfium2_backend import PyPdfiumDocumentBackend
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling_core.types.doc import (
    DoclingDocument,
)
from litellm import completion

log = logging.getLogger(__name__)


class DoclingLLMConverter:
    def __init__(self, document_path: Path, *args, **kwargs):  # noqa: ARG002
        self.document_path = document_path
        self.pipeline_options = self.get_pipeline_options()
        self.converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(
                    backend=PyPdfiumDocumentBackend,
                    pipeline_options=self.pipeline_options,
                ),
            }
        )

    def get_pipeline_options(self):
        pipeline_options = PdfPipelineOptions()
        pipeline_options.images_scale = 2
        pipeline_options.generate_page_images = True
        pipeline_options.generate_picture_images = True
        pipeline_options.generate_table_images = True
        pipeline_options.do_ocr = False
        pipeline_options.do_formula_enrichment = False
        pipeline_options.do_table_structure = False
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

    def ocr_page_image(self, page):
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": settings.IMAGE_OCR_PROMPT},
                    {"type": "image_url", "image_url": {"url": str(page.image.uri)}},
                ],
            }
        ]
        response = completion(
            custom_llm_provider=settings.LITELLM_CUSTOM_PROVIDER,
            api_base=settings.LITELLM_API_BASE,
            model=settings.PDF_TRANSCRIPTION_MODEL,
            messages=messages,
        )
        return response.json()["choices"][0]["message"]["content"]
