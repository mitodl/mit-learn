from pathlib import Path

import pytest

from learning_resources.converters.opendataloader_llm_converter import (
    ImageForOCR,
    OpenDataLoaderLLMConverter,
)


@pytest.fixture
def fake_renderer(mocker):
    renderer = mocker.MagicMock()
    renderer.render_page.return_value = mocker.MagicMock(name="page_image")
    renderer.cleanup = mocker.MagicMock()
    return renderer


@pytest.fixture
def fake_ocr(mocker):
    ocr = mocker.MagicMock()
    ocr.ocr_image.return_value = "OCR_TEXT"
    return ocr


@pytest.fixture(autouse=True)
def mock_litellm(mocker):
    mocker.patch(
        "learning_resources.converters.opendataloader_llm_converter.litellm.completion",
        return_value={"choices": [{"message": {"content": "OCR TEXT"}}]},
    )
    mocker.patch(
        "learning_resources.converters.opendataloader_llm_converter.OCRProcessor._execute_batch_ocr",
        return_value=["OCR TEXT"],
    )


def test_basic_conversion(settings):
    """
    Test a very basic conversion of pdf to markdown
    """
    settings.OCR_MODEL = "test"
    sample_pdf = Path("test_pdfs/notes.pdf")
    converter = OpenDataLoaderLLMConverter(document_path=sample_pdf, debug_mode=False)
    markdown = converter.convert_to_markdown()
    assert isinstance(markdown, str)
    assert "OCR TEXT" in markdown


def test_debug_images_written(tmp_path, mocker, settings):
    """
    Test debug_mode flag outputs debug images
    """
    settings.OCR_MODEL = "test"
    mocker.patch(
        "learning_resources.converters.opendataloader_llm_converter.settings.OCR_DEBUG_DIRECTORY",
        tmp_path,
    )
    sample_pdf = Path("test_pdfs/notes.pdf")
    converter = OpenDataLoaderLLMConverter(sample_pdf, debug_mode=True)
    converter.convert_to_markdown()
    assert len(list(tmp_path.glob("*notes"))) > 0


def test_tiny_images_are_skipped(fake_renderer, fake_ocr, mocker):
    """
    Test that small images or images with odd dimensions are skipped
    """
    with (
        mocker.patch(
            "learning_resources.converters.opendataloader_llm_converter.PDFPageRenderer",
            return_value=fake_renderer,
        ),
        mocker.patch(
            "learning_resources.converters.opendataloader_llm_converter.OCRProcessor",
            return_value=fake_ocr,
        ),
    ):
        conv = OpenDataLoaderLLMConverter("fake.pdf")

        tiny = ImageForOCR(
            pil_image=mocker.MagicMock(size=(41, 5)),
            is_full_page=False,
            block_id="tiny",
        )

        conv._ocr_processor.process_images([tiny])  # noqa: SLF001

        fake_ocr.ocr_image.assert_not_called()
