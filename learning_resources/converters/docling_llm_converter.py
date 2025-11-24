import logging
from pathlib import Path

from docling.backend.pypdfium2_backend import PyPdfiumDocumentBackend
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption

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
