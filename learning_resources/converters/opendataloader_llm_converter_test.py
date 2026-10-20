from pathlib import Path
from types import SimpleNamespace

import pytest
from PIL import Image

from learning_resources.converters.opendataloader_llm_converter import (
    OCR_FAILED_PLACEHOLDER,
    PAGE_CACHE_SIZE,
    ImageForOCR,
    MarkdownAssembler,
    OCRProcessor,
    OpenDataLoaderLLMConverter,
    PDFPageRenderer,
    _optimize_image,
    parse_content_block,
)

MODULE = "learning_resources.converters.opendataloader_llm_converter"
execute_batch_ocr = OCRProcessor._execute_batch_ocr  # noqa: SLF001


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


def test_basic_conversion(settings, fake_renderer, mocker):
    """
    Test a very basic conversion of pdf to markdown
    """
    settings.OCR_MODEL = "test"
    sample_pdf = Path("test_pdfs/notes.pdf")
    mocker.patch(
        "learning_resources.converters.opendataloader_llm_converter._optimize_image",
        return_value=mocker.MagicMock(),
    )
    mocker.patch(
        "learning_resources.converters.opendataloader_llm_converter.PDFPageRenderer",
        return_value=fake_renderer,
    )
    converter = OpenDataLoaderLLMConverter(document_path=sample_pdf, debug_mode=False)
    markdown = converter.convert_to_markdown()
    assert isinstance(markdown, str)
    assert "OCR TEXT" in markdown


def test_debug_images_written(tmp_path, mocker, settings, fake_renderer):
    """
    Test debug_mode flag outputs debug images
    """
    settings.OCR_MODEL = "test"
    mocker.patch(
        "learning_resources.converters.opendataloader_llm_converter.settings.OCR_DEBUG_DIRECTORY",
        tmp_path,
    )
    mocker.patch(
        "learning_resources.converters.opendataloader_llm_converter._optimize_image",
        return_value=mocker.MagicMock(),
    )
    mocker.patch(
        "learning_resources.converters.opendataloader_llm_converter.PDFPageRenderer",
        return_value=fake_renderer,
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
        sample_pdf = Path("test_pdfs/notes.pdf")
        conv = OpenDataLoaderLLMConverter(sample_pdf)

        tiny = ImageForOCR(
            image_uri="data:image/jpeg;base64,",
            is_full_page=False,
            block_id="tiny",
        )

        conv._ocr_processor.process_images([tiny])  # noqa: SLF001

        fake_ocr.ocr_image.assert_not_called()


def _paragraph(content, page=1, **kwargs):
    return {"type": "paragraph", "page number": page, "content": content, **kwargs}


def _list_block(items, numbering_style="arabic numbers"):
    return {
        "type": "list",
        "page number": 1,
        "numbering style": numbering_style,
        "list items": items,
    }


def test_nested_list_text_is_kept():
    """Text nested under a list item's kids should not be dropped"""
    blocks = [
        parse_content_block(
            _list_block(
                [
                    {
                        "type": "list item",
                        "content": "First part, and that",
                        "kids": [
                            _paragraph("the objective is to maximize surplus"),
                            _list_block(
                                [{"type": "list item", "content": "sub item"}],
                                numbering_style="bullets",
                            ),
                        ],
                    },
                    {"type": "list item", "content": "Second part"},
                ]
            )
        )
    ]
    markdown = MarkdownAssembler().assemble(blocks, {})
    assert markdown.split("\n\n") == [
        "1. First part, and that",
        "the objective is to maximize surplus",
        "- sub item",
        "2. Second part",
    ]


@pytest.mark.parametrize("label", ["1.", "(a)", "iv)", "b."])
def test_labeled_list_items_not_renumbered(label):
    """List items that already start with a label shouldn't get another one"""
    blocks = [
        parse_content_block(
            _list_block([{"type": "list item", "content": f"{label} Question"}])
        )
    ]
    assert MarkdownAssembler().assemble(blocks, {}) == f"{label} Question"


def test_nested_list_images_keep_their_page(mocker, settings, fake_renderer):
    """Images nested in a list should be OCR'd and placed on their own page"""
    settings.OCR_MATH_DENSITY_THRESHOLD = 100
    mocker.patch(f"{MODULE}._optimize_image", return_value=mocker.MagicMock())
    mocker.patch(f"{MODULE}.PDFPageRenderer", return_value=fake_renderer)
    process_images = mocker.patch.object(
        OCRProcessor, "process_images", return_value={42: "IMAGE TEXT"}
    )
    converter = OpenDataLoaderLLMConverter(Path("test.pdf"))
    mocker.patch.object(
        converter,
        "_convert_pdf_to_json",
        return_value={
            "kids": [
                _list_block(
                    [
                        {
                            "type": "list item",
                            "content": "Item",
                            "kids": [
                                {
                                    "type": "image",
                                    "id": 42,
                                    "page number": 2,
                                    "bounding box": [0, 0, 100, 100],
                                }
                            ],
                        }
                    ]
                ),
            ]
        },
    )
    assert converter.convert_to_markdown() == "1. Item\n\nIMAGE TEXT"
    fake_renderer.extract_region.assert_called_once_with(2, [0, 0, 100, 100])
    assert [img.block_id for img in process_images.call_args.args[0]] == [42]


def test_math_score_includes_nested_text():
    """Text nested in lists and tables should count towards the math score"""
    converter = OpenDataLoaderLLMConverter(Path("test.pdf"))
    table = parse_content_block(
        {
            "type": "table",
            "rows": [
                {
                    "cells": [
                        {"content": "x = 1"},
                        {"kids": [_paragraph("∫ f(x) dx")]},
                    ]
                }
            ],
        }
    )
    lst = parse_content_block(
        _list_block(
            [
                {
                    "type": "list item",
                    "content": "y = 2",
                    "kids": [_paragraph("sin x", font="CMMI10")],
                }
            ]
        )
    )
    # table: 1 + 3, list: 1 + (3 + 1 for the math font)
    assert converter._calculate_page_math_score([table, lst]) == 9  # noqa: SLF001


@pytest.mark.parametrize(
    ("content", "expected"),
    [("w = cos 2\uf8eb L", True), ("bad \ufffd glyph", True), ("plain text", False)],
)
def test_unmappable_glyphs_trigger_full_page_ocr(
    mocker, settings, fake_renderer, content, expected
):
    """Pages with undecodable glyphs should get full-page OCR"""
    settings.OCR_MATH_DENSITY_THRESHOLD = 100
    mocker.patch(f"{MODULE}._optimize_image", return_value=mocker.MagicMock())
    mocker.patch(f"{MODULE}.PDFPageRenderer", return_value=fake_renderer)
    mocker.patch.object(
        OCRProcessor, "process_images", return_value={888001: "FULL PAGE"}
    )
    converter = OpenDataLoaderLLMConverter(Path("test.pdf"))
    mocker.patch.object(
        converter,
        "_convert_pdf_to_json",
        return_value={
            "kids": [_list_block([{"type": "list item", "content": content}])]
        },
    )
    markdown = converter.convert_to_markdown()
    assert (markdown == "FULL PAGE") is expected


def _response(text):
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=text))]
    )


def test_failed_ocr_request_is_retried(mocker, settings):
    """A failed request in a batch is retried once on its own"""
    settings.OCR_REQUEST_TIMEOUT = 33
    settings.OCR_REQUEST_NUM_RETRIES = 4
    mocker.patch.object(OCRProcessor, "_execute_batch_ocr", execute_batch_ocr)
    batch = mocker.patch(
        f"{MODULE}.batch_completion",
        return_value=[_response("one"), Exception("timeout")],
    )
    completion = mocker.patch(
        f"{MODULE}.litellm.completion", return_value=_response("two")
    )
    images = [
        ImageForOCR(1, "data:image/jpeg;base64,", is_full_page=False),
        ImageForOCR(2, "data:image/jpeg;base64,", is_full_page=False),
    ]
    assert OCRProcessor().process_images(images) == {1: "one", 2: "two"}
    for mock in (batch, completion):
        assert mock.call_args.kwargs["timeout"] == 33
        assert mock.call_args.kwargs["num_retries"] == 4
    completion.assert_called_once()


def test_failed_ocr_retry_uses_placeholder(mocker):
    """A request that fails twice is replaced by a placeholder"""
    mocker.patch.object(OCRProcessor, "_execute_batch_ocr", execute_batch_ocr)
    mocker.patch(
        f"{MODULE}.batch_completion",
        return_value=[Exception("timeout"), _response("two")],
    )
    mocker.patch(f"{MODULE}.litellm.completion", side_effect=Exception("timeout"))
    images = [
        ImageForOCR(1, "data:image/jpeg;base64,", is_full_page=False),
        ImageForOCR(2, "data:image/jpeg;base64,", is_full_page=False),
    ]
    assert OCRProcessor().process_images(images) == {
        1: OCR_FAILED_PLACEHOLDER,
        2: "two",
    }


@pytest.mark.parametrize(("num_colors", "expect_binary"), [(2, True), (500, False)])
def test_optimize_image(num_colors, expect_binary):
    """Few-color images are thresholded, many-color images are blurred"""
    image = Image.new("RGB", (num_colors, 1))
    image.putdata([(255 * (i % 2), i % 256, i // 256) for i in range(num_colors)])
    result = _optimize_image(image)
    assert result.mode == "L"
    values = {value for _, value in result.getcolors()}
    is_binary = values <= {0, 255}
    assert is_binary is expect_binary


def test_page_cache_is_bounded(mocker):
    """The renderer keeps only the most recently used pages"""
    pages = {}

    def render(_path, dpi, first_page, last_page):
        pages[first_page] = mocker.MagicMock(name=f"page{first_page}")
        return [pages[first_page]]

    mocker.patch(f"{MODULE}.pdf2image.convert_from_path", side_effect=render)
    renderer = PDFPageRenderer(Path("test.pdf"))
    for page_number in range(1, PAGE_CACHE_SIZE + 3):
        renderer.get_page_image(page_number)
    assert list(renderer._page_cache) == list(range(3, PAGE_CACHE_SIZE + 3))  # noqa: SLF001
    pages[1].close.assert_called_once()
    pages[2].close.assert_called_once()
    pages[3].close.assert_not_called()
