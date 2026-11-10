import json
from pathlib import Path
from types import SimpleNamespace

import pymupdf
import pytest
from PIL import Image

from learning_resources.converters.opendataloader_llm_converter import (
    GRAPHIC,
    OCR_FAILED_PLACEHOLDER,
    PAGE_CACHE_SIZE,
    REGION,
    BlockType,
    ContentBlock,
    Figure,
    ImageForOCR,
    MarkdownAssembler,
    OCRProcessor,
    OpenDataLoaderLLMConverter,
    PDFPageRenderer,
    _optimize_image,
    _unwrap_header_footer,
    assemble_structure,
    display_box,
    document_math,
    export_structure_markdown,
    flatten_lists,
    page_math,
    parse_content_block,
    parse_figure_mark,
    prepare_structure,
    strip_running_lines,
    structure_elements,
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


@pytest.fixture
def no_pdf(mocker):
    """Skip the steps that open the PDF itself, for converters of a fake path"""
    mocker.patch.object(OpenDataLoaderLLMConverter, "_find_figures")
    mocker.patch.object(OpenDataLoaderLLMConverter, "_turn_blocks")


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
        "<!-- page: 1 -->",
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
    assert (
        MarkdownAssembler().assemble(blocks, {})
        == f"<!-- page: 1 -->\n\n{label} Question"
    )


def test_children_only_list_items_keep_markers():
    """Items whose text is only in their kids still get their markers"""
    blocks = [
        parse_content_block(
            _list_block(
                [
                    {"type": "list item", "kids": [{"type": "image", "id": 7}]},
                    {
                        "type": "list item",
                        "kids": [_paragraph("Question"), _paragraph("More text")],
                    },
                    {"type": "list item", "kids": [_paragraph("(c) Labeled")]},
                ]
            )
        )
    ]
    markdown = MarkdownAssembler().assemble(blocks, {7: "IMAGE TEXT"})
    assert markdown.split("\n\n") == [
        "<!-- page: 1 -->",
        "IMAGE TEXT",
        "2. Question",
        "More text",
        "(c) Labeled",
    ]


def test_list_markers_not_scored_as_math():
    """Generated list markers shouldn't count towards the math score"""
    converter = OpenDataLoaderLLMConverter(Path("test.pdf"))
    bullets = parse_content_block(
        _list_block(
            [{"type": "list item", "content": f"Plain item {i}"} for i in range(6)],
            numbering_style="bullets",
        )
    )
    blocks = flatten_lists([bullets])
    assert all(block.list_marker == "-" for block in blocks)
    assert converter._calculate_page_math_score(blocks) == 0  # noqa: SLF001


def test_nested_list_images_keep_their_page(mocker, settings, fake_renderer, no_pdf):
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
    assert converter.convert_to_markdown() == (
        "<!-- page: 1 -->\n\n1. Item\n\n<!-- page: 2 -->\n\nIMAGE TEXT"
    )
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
    [
        ("w = cos 2\uf8eb L", True),
        ("bad \ufffd glyph", True),
        ("plain text", False),
        ("\uf0b7 Word bullet \uf0a7 Wingdings bullet", False),
    ],
)
def test_unmappable_glyphs_trigger_full_page_ocr(  # noqa: PLR0913
    mocker, settings, fake_renderer, no_pdf, content, expected
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
    assert (markdown == "<!-- page: 1 -->\n\nFULL PAGE") is expected


def _response(text):
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=text))]
    )


def test_failed_ocr_request_returns_none(mocker, settings):
    """A failed request's result is None and isn't retried again"""
    settings.OCR_REQUEST_TIMEOUT = 33
    settings.OCR_REQUEST_NUM_RETRIES = 4
    mocker.patch.object(OCRProcessor, "_execute_batch_ocr", execute_batch_ocr)
    batch = mocker.patch(
        f"{MODULE}.batch_completion",
        return_value=[_response("one"), Exception("timeout")],
    )
    completion = mocker.patch(f"{MODULE}.litellm.completion")
    images = [
        ImageForOCR(1, "data:image/jpeg;base64,", is_full_page=False),
        ImageForOCR(2, "data:image/jpeg;base64,", is_full_page=False),
    ]
    assert OCRProcessor().process_images(images) == {1: "one", 2: None}
    assert batch.call_args.kwargs["timeout"] == 33
    assert batch.call_args.kwargs["num_retries"] == 4
    completion.assert_not_called()


def test_failed_ocr_falls_back(mocker, settings, fake_renderer, no_pdf):
    """
    A failed full-page OCR uses the page's parsed text, and a failed image
    becomes a placeholder
    """
    settings.OCR_MATH_DENSITY_THRESHOLD = 2
    mocker.patch(f"{MODULE}._optimize_image", return_value=mocker.MagicMock())
    mocker.patch(f"{MODULE}.PDFPageRenderer", return_value=fake_renderer)
    mocker.patch.object(
        OCRProcessor, "process_images", return_value={888001: None, 5: None}
    )
    converter = OpenDataLoaderLLMConverter(Path("test.pdf"))
    mocker.patch.object(
        converter,
        "_convert_pdf_to_json",
        return_value={
            "kids": [
                _paragraph("∫ f(x) dx = 1"),
                {"type": "heading", "page number": 1, "content": "Title"},
                _paragraph("Page two", page=2),
                {
                    "type": "image",
                    "id": 5,
                    "page number": 2,
                    "bounding box": [0, 0, 100, 100],
                },
            ]
        },
    )
    assert converter.convert_to_markdown().split("\n\n") == [
        "<!-- page: 1 -->",
        "∫ f(x) dx = 1",
        "# Title",
        "<!-- page: 2 -->",
        "Page two",
        OCR_FAILED_PLACEHOLDER,
    ]


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


def _block(block_type, content=None, box=(0, 0, 100, 10), page=1, **kwargs):
    return ContentBlock(
        block_type=block_type,
        block_id=kwargs.pop("block_id", 0),
        page_number=page,
        bounding_box=list(box),
        content=content,
        **kwargs,
    )


def test_captions_and_notes_are_kept():
    """Captions and notes are written as text"""
    blocks = [
        _block("caption", "Figure 1: a caption", box=(0, 0, 100, 40)),
        _block("note", "A note", box=(0, 50, 100, 90)),
    ]
    markdown = MarkdownAssembler().assemble(blocks, {})
    assert markdown.split("\n\n") == [
        "<!-- page: 1 -->",
        "Figure 1: a caption",
        "A note",
    ]


def test_table_drops_empty_columns():
    """Columns empty in every row go, and a one-column table is plain text"""
    table = parse_content_block(
        {
            "type": "table",
            "rows": [
                {"cells": [{"content": ""}, {"content": "a"}, {"content": "b"}]},
                {"cells": [{"content": ""}, {"content": "1"}, {"content": "2"}]},
            ],
        }
    )
    one_column = parse_content_block(
        {
            "type": "table",
            "rows": [
                {"cells": [{"content": ""}, {"content": "First line"}]},
                {"cells": [{"content": ""}, {"content": "Second line"}]},
            ],
        }
    )
    assembler = MarkdownAssembler()
    assert assembler._format_table(table) == "| a | b |\n| --- | --- |\n| 1 | 2 |"  # noqa: SLF001
    assert assembler._format_table(one_column) == "First line\n\nSecond line"  # noqa: SLF001


def test_fragmented_lines_are_rejoined():
    """Runs of a line split into fragments are rejoined into one line"""
    blocks = [
        _block("paragraph", "What is", box=(10, 700, 50, 712)),
        _block("paragraph", "the energy of", box=(53, 700, 120, 712)),
        _block("paragraph", "light?", box=(123, 700, 150, 712)),
    ]
    assert MarkdownAssembler().assemble(blocks, {}) == (
        "<!-- page: 1 -->\n\nWhat is the energy of light?"
    )


def test_running_headers_and_footers_are_removed():
    """A header on one page is content; page numbers and running lines go"""
    kids = [
        {"type": "header", "page number": 1, "kids": [_paragraph("Problem 3")]},
        *(
            {
                "type": "footer",
                "page number": page,
                "kids": [_paragraph(f"18.01 Fall 2026 page {page}", page=page)],
            }
            for page in range(1, 4)
        ),
        {"type": "footer", "page number": 2, "kids": [_paragraph("7", page=2)]},
    ]
    assert [k["content"] for k in _unwrap_header_footer(kids)] == ["Problem 3"]
    pages = "".join(
        f"<!-- page: {n} -->\n\n{body}\n\nCalculus course notes\n\n"
        for n, body in enumerate(["Limits.", "Derivatives.", "Integrals."], start=1)
    )
    stripped = strip_running_lines(pages)
    assert "course notes" not in stripped
    assert all(body in stripped for body in ["Limits.", "Derivatives.", "Integrals."])


@pytest.mark.parametrize(
    ("rotation", "expected"),
    [
        (0, [10, 20, 30, 40]),
        (90, [20, 70, 40, 90]),
        (180, [70, 60, 90, 80]),
        (270, [60, 10, 80, 30]),
    ],
)
def test_display_box(rotation, expected):
    """Boxes in a rotated page's own space are put on the page as shown"""
    assert display_box([10, 20, 30, 40], rotation, 100, 100) == expected


@pytest.mark.parametrize(
    ("mark", "expected"),
    [
        ("p2_1 | a plot", ("p2_1", "a plot", None)),
        ("a plot | 0.1,0.2,0.3,0.4", ("new", "a plot", "0.1,0.2,0.3,0.4")),
        (
            "new | $|\\tau|$ vs t | 0.1,0.2,0.3,0.4",
            ("new", "$|\\tau|$ vs t", "0.1,0.2,0.3,0.4"),
        ),
        ("p1_3 \\| a table cell", ("p1_3", "a table cell", None)),
    ],
)
def test_parse_figure_mark(mark, expected):
    """Figure marks are read however loosely the model writes them"""
    assert parse_figure_mark(mark) == expected


@pytest.fixture
def figure_page(no_pdf):
    """Make a converter with one candidate figure on page 1, and its image block"""
    converter = OpenDataLoaderLLMConverter(Path("test.pdf"))
    figure = Figure("p1_1", 1, [100, 400, 300, 600], None, 612, 792)
    converter.figures = [figure]
    image = _block(
        "image",
        box=figure.bounding_box,
        block_id=converter._figure_block_id(figure),  # noqa: SLF001
    )
    return converter, figure, image


def test_figure_decided_as_graphic(figure_page):
    """A candidate the OCR reports as a graphic is a placeholder"""
    converter, figure, image = figure_page
    results = {image.block_id: "<!-- figure: a free-body diagram -->"}
    converter._resolve_figures([image], results)  # noqa: SLF001
    assert figure.kind == GRAPHIC
    assert results[image.block_id] == figure.placeholder()
    assert 'description="a free-body diagram"' in results[image.block_id]


def test_figure_ocr_failure_keeps_a_graphic(figure_page):
    """A candidate whose OCR request failed stays in place as a graphic"""
    converter, figure, image = figure_page
    results = {image.block_id: None}
    converter._resolve_figures([image], results)  # noqa: SLF001
    assert figure.kind == GRAPHIC
    assert results[image.block_id] == figure.placeholder()


def test_rejected_crop_falls_back_to_placeholder(figure_page, mocker, tmp_path):
    """A graphic whose crop extract_region rejects is a placeholder, not a link"""
    converter, figure, image = figure_page
    converter.figures_dir = tmp_path
    converter._page_renderer = mocker.Mock(  # noqa: SLF001
        **{"extract_region.return_value": None}
    )
    mocker.patch.object(converter, "_markdown_assembler", MarkdownAssembler())
    markdown = converter._finish(  # noqa: SLF001
        [image], {image.block_id: "<!-- figure: a long thin rule -->"}
    )
    assert figure.path is None
    assert figure.placeholder() in markdown
    assert ".png" not in markdown


def test_figure_ocr_failure_keeps_parsed_text(figure_page):
    """The parsed text a failed candidate replaced is written after it"""
    converter, figure, _ = figure_page
    inside = _block("paragraph", "Text inside the figure.", box=(120, 450, 280, 470))
    outside = _block("paragraph", "Text below.", box=(100, 300, 300, 320))
    blocks = converter._with_figure_blocks(1, [inside, outside])  # noqa: SLF001
    [image] = [b for b in blocks if b.block_type == "image"]
    assert inside not in blocks
    assert image.fallback_blocks == [inside]
    results = {image.block_id: None}
    converter._resolve_figures(blocks, results)  # noqa: SLF001
    markdown = MarkdownAssembler().assemble(blocks, results)
    assert figure.placeholder() in markdown
    assert markdown.index(figure.placeholder()) < markdown.index("Text inside")


def test_figure_ocr_replaces_parsed_text(figure_page):
    """A candidate whose OCR returned stands for the parsed text inside it"""
    converter, _, _ = figure_page
    inside = _block("paragraph", "Text inside the figure.", box=(120, 450, 280, 470))
    blocks = converter._with_figure_blocks(1, [inside])  # noqa: SLF001
    [image] = blocks
    results = {image.block_id: "Transcribed text."}
    converter._resolve_figures(blocks, results)  # noqa: SLF001
    markdown = MarkdownAssembler().assemble(blocks, results)
    assert "Transcribed text." in markdown
    assert "Text inside" not in markdown


def test_figure_region_keeps_its_transcription(figure_page):
    """A layout-heavy region is shown with its transcription beside it"""
    converter, figure, image = figure_page
    results = {image.block_id: "<!-- region: a flowchart -->\nStart -> Stop"}
    converter._resolve_figures([image], results)  # noqa: SLF001
    assert figure.kind == REGION
    assert "<details><summary>Transcription</summary>" in results[image.block_id]
    assert "Start -> Stop" in results[image.block_id]


def test_table_borders_are_not_repeated(figure_page):
    """A candidate that was a parsed table's ruling adds nothing"""
    converter, _, image = figure_page
    table = parse_content_block(
        {
            "type": "table",
            "page number": 1,
            "bounding box": [100, 400, 300, 600],
            "rows": [{"cells": [{"content": "mass"}, {"content": "velocity"}]}],
        }
    )
    results = {image.block_id: "| mass | velocity |"}
    converter._resolve_figures([table, image], results)  # noqa: SLF001
    assert results[image.block_id] == ""


def test_figure_text_already_parsed_is_dropped(figure_page):
    """A figure's transcription of a text line crossing its edge goes"""
    converter, _, image = figure_page
    line = _block(
        "paragraph",
        "7. Please provide a detailed mechanism for the following transformation.",
        box=(60, 590, 400, 602),
    )
    results = {
        image.block_id: "se provide a detailed mechanism for the following "
        "transformation.\n\n$$A \\to B$$"
    }
    converter._resolve_figures([line, image], results)  # noqa: SLF001
    assert results[image.block_id] == "$$A \\to B$$"


def test_full_page_figures(figure_page):
    """The page OCR's figure marks become graphics, and unplaced ones are kept"""
    converter, figure, _ = figure_page
    second = Figure("p1_2", 1, [100, 100, 300, 300], None, 612, 792)
    converter.figures.append(second)
    text = (
        "Before.\n\n<!-- figure: p1_1 | a circuit -->\n\nAfter.\n\n"
        "<!-- regions: p1_1=graphic -->"
    )
    markdown = converter._resolve_full_page(1, text)  # noqa: SLF001
    assert markdown.startswith("Before.")
    assert figure.description == "a circuit"
    assert figure.placeholder() in markdown
    assert second.placeholder() in markdown
    assert "regions:" not in markdown


@pytest.mark.parametrize(
    ("blocks", "layer"),
    [
        # scanned: an image covering the page, and no text
        ([{"type": "image", "id": 1, "bounding box": [0, 0, 612, 792]}], ""),
        # an equation editor's matrix
        ([_paragraph("A = ⎡ 1 2 ⎤ ⎣ 3 4 ⎦")], ""),
        # letter-spaced text
        ([_paragraph(" ".join("You learned about sets and functions" * 3))], ""),
        # the parser kept little of the page's text layer
        ([_paragraph("Short")], "A long text layer the parser lost " * 4),
    ],
)
def test_page_needs_full_ocr(  # noqa: PLR0913
    mocker, settings, fake_renderer, no_pdf, blocks, layer
):
    """Pages whose parsed text can't stand for the page are OCR'd in full"""
    settings.OCR_MATH_DENSITY_THRESHOLD = 100
    mocker.patch(f"{MODULE}._optimize_image", return_value=mocker.MagicMock())
    mocker.patch(f"{MODULE}.PDFPageRenderer", return_value=fake_renderer)
    mocker.patch.object(
        OCRProcessor, "process_images", return_value={888001: "FULL PAGE"}
    )
    converter = OpenDataLoaderLLMConverter(Path("test.pdf"))
    converter._layer_text = {1: layer}  # noqa: SLF001
    mocker.patch.object(
        converter,
        "_convert_pdf_to_json",
        return_value={"kids": [{"page number": 1, **b} for b in blocks]},
    )
    assert converter.convert_to_markdown() == "<!-- page: 1 -->\n\nFULL PAGE"


# --- structure ----------------------------------------------------------------


def _segment(plan, needle, role, *, through=None, **data):
    start = next(e for e in plan["elements"] if needle in e["text"])
    end = (
        next(e for e in plan["elements"] if through in e["text"]) if through else start
    )
    return {
        "start": start["id"],
        "end": end["id"],
        "role": role,
        "confidence": "high",
        **data,
    }


def _answer(segments, kind="problem_set"):
    return {
        "kind": kind,
        "title": "Problem Set",
        "title_is_printed": True,
        "segments": segments,
    }


def test_structure_partition_is_lossless():
    """Elements cover the source exactly, regions, tables and fences included"""
    text = (
        "<!-- page: 1 -->\n\n<!-- region p1_1 -->\n"
        "<details><summary>Transcription</summary>\n\n## Problem #1\n"
        "| a | b |\n|---|---|\n| 1 | 2 |\n\n~~~python\n# not a heading\n~~~\n"
        "</details>\n<!-- /region -->\n"
    )
    elements = structure_elements(text)
    assert "".join(e["text"] for e in elements) == text
    assert any(e["kind"] == "code" and "# not a heading" in e["text"] for e in elements)
    assert all(text[e["start"] : e["end"]] == e["text"] for e in elements)


def test_structure_figure_placeholders_are_elements():
    """Figure placeholders are figure elements with their position"""
    figure = Figure(
        "p1_1", 1, [100, 400, 300, 600], None, 612, 792, description="a plot"
    )
    elements = structure_elements(f"Text.\n\n{figure.placeholder()}\n")
    plan, _ = prepare_structure(f"Text.\n\n{figure.placeholder()}\n")
    assert [e["kind"] for e in elements if e["kind"] == "figure"] == ["figure"]
    located = next(e for e in plan["elements"] if e["kind"] == "figure")
    assert located["bbox"] == figure.bbox
    assert located["location_method"] == "figure_source"


def test_structure_parts_have_parents():
    """Parts nest under their problem and parent part, outside the intro"""
    text = (
        "<!-- page: 1 -->\n\n## Problem #1\n\nShared setup.\n\n(a) First request."
        "\n\n(i) Nested request.\n\n(b) Second request."
    )
    plan, _ = prepare_structure(text)
    result = assemble_structure(
        text,
        plan,
        [
            _answer(
                [
                    _segment(
                        plan, "## Problem", "problem", through="Shared", problem="1"
                    ),
                    _segment(plan, "(a)", "part", problem="1", part="a"),
                    _segment(plan, "(i)", "part", problem="1", part="a.i"),
                    _segment(plan, "(b)", "part", problem="1", part="b"),
                ]
            )
        ],
    )
    assert result["status"] == "validated", result["check"]
    problem = result["problems"][0]
    assert result["body"] == ""
    assert [p["label"] for p in problem["parts"]] == ["a", "a.i", "b"]
    assert problem["parts"][1]["parent_id"] == problem["parts"][0]["id"]
    assert problem["stem"] == "Shared setup."


def test_structure_gaps_and_overlaps_need_review():
    """Unassigned or doubly owned source fails the checks"""
    text = "## Problem 1\n\nDo one.\n\nDo two."
    plan, _ = prepare_structure(text)
    for segments in (
        [_segment(plan, "##", "problem", problem="1")],
        [
            _segment(plan, "##", "problem", through="Do two", problem="1"),
            _segment(plan, "Do one", "part", problem="1", part="a"),
        ],
    ):
        result = assemble_structure(text, plan, [_answer(segments)])
        assert result["status"] == "needs_review"


def test_structure_offsets_split_statement_and_answer():
    """Character offsets give a statement and its answer exact spans"""
    text = "Find x. The answer is 2."
    plan, _ = prepare_structure(text)
    eid = plan["windows"][0]["core"][0]
    base = {"start": eid, "end": eid, "problem": "1", "confidence": "high"}
    result = assemble_structure(
        text,
        plan,
        [
            _answer(
                [
                    {**base, "role": "problem", "end_offset": 8},
                    {**base, "role": "solution", "start_offset": 8},
                ]
            )
        ],
    )
    assert result["check"]["ok"], result["check"]
    assert result["problems"][0]["stem"] == "Find x."
    assert result["problems"][0]["solution"] == "The answer is 2."


def test_structure_answers_only_and_citation_cover():
    """Answers stand without invented statements; OCW covers are excluded"""
    text = (
        "<!-- page: 1 -->\n\n## Problem #1\n\nFirst answer.\n\n## Problem 2\n\n"
        "Second answer.\n\n<!-- page: 2 -->\n\nMIT OpenCourseWare\nhttp://ocw.mit.edu\n"
        "For information about citing these materials or our Terms of Use, "
        "visit: http://ocw.mit.edu/terms.\n"
    )
    plan, _ = prepare_structure(text)
    result = assemble_structure(
        text,
        plan,
        [
            _answer(
                [
                    _segment(
                        plan,
                        "## Problem #1",
                        "solution",
                        through="First answer",
                        problem="1",
                        statement_available=False,
                    ),
                    _segment(
                        plan,
                        "## Problem 2",
                        "solution",
                        through="Second answer",
                        problem="2",
                        statement_available=False,
                    ),
                ],
                "solutions",
            )
        ],
    )
    assert result["status"] == "validated", result["check"]
    assert result["kind"] == "solutions"
    assert all(not p["statement_available"] for p in result["problems"])
    assert "ocw.mit.edu" not in result["problems"][-1]["solution"]


def test_structure_documents_without_problems():
    """Game cards and study lists stay documents"""
    for kind, text in [
        ("data", "## Game Cards\n\n### Player A\n\nDraw two cards."),
        ("topic_list", "## Study Sheet\n\n1. Painting A\n2. Painting B"),
    ]:
        plan, _ = prepare_structure(text)
        segments = [_segment(plan, "##", "body", through=text.splitlines()[-1])]
        result = assemble_structure(text, plan, [_answer(segments, kind)])
        assert result["check"]["ok"], result["check"]
        assert result["problems"] == []
        assert result["kind"] == kind


def test_structure_dependencies():
    """A problem's cited material outside it is kept with its text"""
    text = "Use the data in table.csv.\n\n## Problem 1\n\nFit a line to the data."
    plan, _ = prepare_structure(text)
    intro = _segment(plan, "Use the data", "intro")
    problem = _segment(plan, "## Problem", "problem", through="Fit", problem="1")
    problem["depends_on"] = [
        {"start": intro["start"], "end": intro["end"], "reason": "data set"}
    ]
    result = assemble_structure(text, plan, [_answer([intro, problem])])
    assert result["check"]["ok"], result["check"]
    [dependency] = result["problems"][0]["dependencies"]
    assert dependency["reason"] == "data set"
    assert dependency["text"] == "Use the data in table.csv."


def test_structure_source_change_invalidates_plan():
    """A plan only assembles the markdown it was made from"""
    plan, _ = prepare_structure("Original text.")
    with pytest.raises(ValueError, match="does not match"):
        assemble_structure("Changed text.", plan, [])


def test_structure_export_keeps_source_order():
    """The exported markdown keeps continuations in source order"""
    text = "## Problem 1\n\nQuestion.\n\nAnswer.\n\nContinuation."
    plan, _ = prepare_structure(text)
    result = assemble_structure(
        text,
        plan,
        [
            _answer(
                [
                    _segment(plan, "##", "problem", through="Question.", problem="1"),
                    _segment(plan, "Answer.", "solution", problem="1"),
                    _segment(plan, "Continuation.", "problem", problem="1"),
                ]
            )
        ],
    )
    exported = export_structure_markdown(text, result)
    assert exported.index("Question.") < exported.index("Answer.")
    assert exported.index("Answer.") < exported.index("Continuation.")
    assert len(result["problems"]) == 1


def test_structure_export_keeps_source_between_spans():
    """Region wrappers and page markers stay; an OCW citation cover page goes"""
    text = (
        "<!-- page: 1 -->\n\n## Problem 1\n\n<!-- region p1_1 -->\n"
        "![a flowchart](p1_1.png)\n\n<details><summary>Transcription</summary>\n\n"
        "Start then stop.\n\n</details>\n<!-- /region -->\n\n<!-- page: 2 -->\n\n"
        "MIT OpenCourseWare\nhttp://ocw.mit.edu\n"
        "For information about citing these materials or our Terms of Use, "
        "visit: http://ocw.mit.edu/terms.\n"
    )
    plan, _ = prepare_structure(text)
    result = assemble_structure(
        text,
        plan,
        [
            _answer(
                [_segment(plan, "## Problem", "problem", through="Start", problem="1")]
            )
        ],
    )
    assert result["status"] == "validated", result["check"]
    exported = export_structure_markdown(text, result)
    assert "<details><summary>Transcription</summary>" in exported
    assert exported.index("Start then stop.") < exported.index("</details>")
    assert "<!-- page: 1 -->" in exported
    # the cover page goes whole, its page marker included
    assert "<!-- page: 2 -->" not in exported
    assert "For information about citing" not in exported


def test_structure_export_tags_document_and_problems():
    """The header names the document; a problem's tag carries its fields"""
    text = "## Problem 1\n\nCalculate the result."
    plan, _ = prepare_structure(text)
    result = assemble_structure(
        text,
        plan,
        [_answer([_segment(plan, "##", "problem", through="Calculate", problem="1")])],
    )
    exported = export_structure_markdown(text, result)
    header, *rest = exported.split("\n")
    header = json.loads(header.removeprefix("<!-- structure: ").removesuffix(" -->"))
    assert header["kind"] == "problem_set"
    assert header["title"] == "Problem Set"
    assert header["status"] == "validated"
    [tag] = [
        json.loads(line.removeprefix("<!-- node: ").removesuffix(" -->"))
        for line in rest
        if line.startswith("<!-- node: ")
    ]
    assert tag["role"] == "problem"
    assert tag["number"] == "1"
    assert tag["statement_available"] is True
    assert "topics" not in tag


def test_structure_export_tags_problems_without_statements():
    """A solution's problem is tagged before it though the file has no statement"""
    text = "## Problem 1\n\nFirst answer.\n\n## Problem 2\n\nSecond answer."
    plan, _ = prepare_structure(text)
    segments = [
        _segment(
            plan,
            f"## Problem {n}",
            "solution",
            through=f"{word} answer",
            problem=str(n),
            statement_available=False,
        )
        for n, word in ((1, "First"), (2, "Second"))
    ]
    result = assemble_structure(text, plan, [_answer(segments, "solutions")])
    assert result["status"] == "validated", result["check"]
    tags = [
        json.loads(line.removeprefix("<!-- node: ").removesuffix(" -->"))
        for line in export_structure_markdown(text, result).split("\n")
        if line.startswith("<!-- node: ")
    ]
    assert [(t["role"], t["problem"]) for t in tags] == [
        ("problem", "1"),
        ("solution", "1"),
        ("problem", "2"),
        ("solution", "2"),
    ]
    assert tags[1]["parent_id"] == tags[0]["id"]
    assert tags[0]["statement_available"] is False


def test_convert_to_structured_markdown(mocker, caplog):
    """The converted markdown is tagged; a failed structure leaves it untagged"""
    converter = OpenDataLoaderLLMConverter(Path("test.pdf"))
    text = "## Problem 1\n\nCalculate the result."
    mocker.patch.object(converter, "convert_to_markdown", return_value=text)
    plan, _ = prepare_structure(text)
    validated = assemble_structure(
        text,
        plan,
        [_answer([_segment(plan, "##", "problem", through="Calculate", problem="1")])],
    )
    structure = mocker.patch.object(converter, "structure", return_value=validated)
    tagged = converter.convert_to_structured_markdown()
    assert tagged == export_structure_markdown(text, validated)
    assert '"role": "problem"' in tagged

    structure.return_value = assemble_structure(text, plan, [{}])
    assert converter.convert_to_structured_markdown() == text
    assert "needs review" in caplog.text

    structure.side_effect = RuntimeError("structure model unavailable")
    assert converter.convert_to_structured_markdown() == text


def test_rejected_boilerplate_keeps_source_text(mocker):
    """A real paragraph labelled boilerplate fails the checks and stays"""
    converter = OpenDataLoaderLLMConverter(Path("test.pdf"))
    paragraph = " ".join(["Consider the circuit shown below."] * 40)
    text = f"## Problem 1\n\nCalculate the result.\n\n{paragraph}"
    mocker.patch.object(converter, "convert_to_markdown", return_value=text)
    plan, _ = prepare_structure(text)
    result = assemble_structure(
        text,
        plan,
        [
            _answer(
                [
                    _segment(plan, "##", "problem", through="Calculate", problem="1"),
                    _segment(plan, "Consider", "boilerplate", reason="footer"),
                ]
            )
        ],
    )
    assert "large boilerplate exclusion needs review" in result["check"]["errors"]
    assert paragraph not in export_structure_markdown(text, result)
    mocker.patch.object(converter, "structure", return_value=result)
    assert converter.convert_to_structured_markdown() == text


def test_null_solution_part_with_parts():
    """A whole-problem solution with "part": null assembles with the parts"""
    text = "## Problem 1\n\n(a) Find x.\n\nSolution: x = 2."
    plan, _ = prepare_structure(text)
    result = assemble_structure(
        text,
        plan,
        [
            _answer(
                [
                    _segment(plan, "##", "problem", problem="1"),
                    _segment(plan, "(a)", "part", problem="1", part="a"),
                    _segment(plan, "Solution", "solution", problem="1", part=None),
                ]
            )
        ],
    )
    (problem,) = result["problems"]
    assert "x = 2" in problem["solution"]
    assert problem["parts"][0]["body"] == "Find x."


def test_convert_to_structured_markdown_skips_empty(mocker):
    """An empty conversion is not sent for structuring"""
    converter = OpenDataLoaderLLMConverter(Path("test.pdf"))
    mocker.patch.object(converter, "convert_to_markdown", return_value="")
    structure = mocker.patch.object(converter, "structure")
    assert converter.convert_to_structured_markdown() == ""
    structure.assert_not_called()


def test_structure_is_repaired_once(mocker, settings):
    """A structure that fails its checks is retried with the failed checks"""
    settings.STRUCTURE_MODEL = "structure-model"
    text = "## Problem 1\n\nCalculate the result."
    plan, _ = prepare_structure(text)
    good = _answer([_segment(plan, "##", "problem", through="Calculate", problem="1")])
    completion = mocker.patch(
        f"{MODULE}.litellm.completion",
        side_effect=[
            SimpleNamespace(
                choices=[
                    SimpleNamespace(message=SimpleNamespace(content=json.dumps(a)))
                ],
                usage={"prompt_tokens": 10, "completion_tokens": 5},
            )
            for a in (_answer([]), good)
        ],
    )
    converter = OpenDataLoaderLLMConverter(Path("test.pdf"))
    result = converter.structure(text)
    assert result["status"] == "validated", result["check"]
    assert completion.call_count == 2
    assert completion.call_args.kwargs["model"] == "structure-model"
    repair_prompt = completion.call_args.kwargs["messages"][0]["content"][0]["text"]
    assert "A previous attempt failed these checks" in repair_prompt
    assert converter.usage.requests == 2


def test_reflow_keeps_columns_apart():
    """Fragmented two-column text is reflowed one column at a time"""
    lines = [
        ([50, 700, 140, 710], "LEFT_START"),
        ([145, 700, 250, 710], "left continues"),
        ([50, 686, 250, 696], "LEFT_END."),
        ([350, 700, 550, 710], "RIGHT_START"),
        ([350, 686, 550, 696], "RIGHT_END."),
    ]
    blocks = [
        ContentBlock(
            block_type=BlockType.TEXT_BLOCK,
            block_id=i,
            page_number=1,
            bounding_box=box,
            content=text,
        )
        for i, (box, text) in enumerate(lines, start=1)
    ]
    assert MarkdownAssembler().assemble(blocks, {}).split("\n\n") == [
        "<!-- page: 1 -->",
        "LEFT_START left continues LEFT_END.",
        "RIGHT_START RIGHT_END.",
    ]


def test_list_bullets_and_full_width_labels():
    """A bullet in an item's text gives way to the marker; CJK labels are kept"""
    blocks = [
        parse_content_block(
            _list_block(
                [{"type": "list item", "content": "• Degrees from MIT "}],
                numbering_style="bullets",
            )
        ),
        parse_content_block(
            _list_block([{"type": "list item", "content": "1．當初送不送有慶去念書"}])  # noqa: RUF001
        ),
    ]
    assert MarkdownAssembler().assemble(blocks, {}).split("\n\n") == [
        "<!-- page: 1 -->",
        "- Degrees from MIT",
        "1．當初送不送有慶去念書",  # noqa: RUF001
    ]


INLINE_MATH_BODY = (
    "The car is at rest at the origin and starts to move along a straight line. " * 3
)


def _inline_math_pdf(tmp_path, draws):
    """Write a PDF with one page per draw function."""
    doc = pymupdf.open()
    for draw in draws:
        draw(doc.new_page())
    path = tmp_path / "page.pdf"
    doc.save(path)
    return path


def _plain_page(page):
    page.insert_textbox(
        pymupdf.Rect(72, 72, 540, 300), INLINE_MATH_BODY, fontname="helv", fontsize=12
    )


def _inline_math_page(page):
    _plain_page(page)
    # Φ with a lowered "total" subscript
    page.insert_text((72, 340), "F", fontname="symb", fontsize=12)
    page.insert_text((82, 343), "total", fontname="helv", fontsize=8)
    page.insert_text(
        (140, 340), "abg", fontname="symb", fontsize=12
    )  # alpha beta gamma


def test_inline_math_is_found_and_plain_text_is_not(tmp_path):
    """Math set inline in a text-layer page is found; plain text is not."""
    found = document_math(_inline_math_pdf(tmp_path, [_plain_page, _inline_math_page]))
    assert not found[1].flattened
    assert found[2].flattened
    assert found[2].math_chars >= 3
    assert found[2].scripts == 1


def test_a_lone_math_letter_is_not_inline_math(tmp_path):
    """One math-font letter isn't enough to OCR the page."""

    def one_letter(page):
        _plain_page(page)
        page.insert_text((72, 340), "p", fontname="symb", fontsize=12)

    with pymupdf.open(_inline_math_pdf(tmp_path, [one_letter])) as doc:
        math = page_math(doc[0])
    assert math.math_chars == 1
    assert not math.flattened
