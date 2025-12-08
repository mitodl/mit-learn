from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from learning_resources.converters.docling_llm_converter import DoclingLLMConverter


@pytest.fixture(autouse=True)
def mock_layout_predictor():
    with patch(
        "docling_ibm_models.layoutmodel.layout_predictor.LayoutPredictor", MagicMock()
    ):
        yield


@pytest.fixture(autouse=True)
def mock_hf(mocker, tmp_path):
    # Mock out the hub completely
    mocker.patch("huggingface_hub.snapshot_download", return_value=tmp_path)
    mocker.patch(
        "huggingface_hub.hf_hub_download", return_value=str(tmp_path / "fake.bin")
    )
    # In case transformers tries to load a model:
    mocker.patch("transformers.AutoModel.from_pretrained", return_value=mocker.Mock())
    mocker.patch(
        "transformers.AutoTokenizer.from_pretrained", return_value=mocker.Mock()
    )


@pytest.fixture(autouse=True)
def mock_litellm(mocker):
    mocker.patch(
        "learning_resources.converters.docling_llm_converter.litellm.completion",
        return_value={"choices": [{"message": {"content": "OCR TEXT"}}]},
    )
    mocker.patch(
        "learning_resources.converters.docling_llm_converter.DoclingLLMConverter.batch_transcribe",
        return_value=[],
    )
    mocker.patch(
        "learning_resources.converters.docling_llm_converter.DoclingLLMConverter.ocr_page_image",
        return_value="OCR TEXT",
    )


def test_basic_conversion(settings):
    """
    Test a very basic conversion of pdf to markdown
    """
    settings.OCR_MODEL = "test"
    sample_pdf = Path("test_pdfs/notes.pdf")
    converter = DoclingLLMConverter(document_path=sample_pdf, debug_mode=False)
    markdown = converter.convert_to_markdown()
    assert isinstance(markdown, str)
    assert "OCR TEXT" in markdown


def test_debug_images_written(tmp_path, mocker, settings):
    """
    Test debug_mode flag outputs debug images
    """
    settings.OCR_MODEL = "test"
    mocker.patch(
        "learning_resources.converters.docling_llm_converter.settings.OCR_DEBUG_DIRECTORY",
        tmp_path,
    )
    sample_pdf = Path("test_pdfs/notes.pdf")
    converter = DoclingLLMConverter(sample_pdf, debug_mode=True)
    converter.convert_to_markdown()
    assert len(list(tmp_path.glob("*notes"))) > 0
