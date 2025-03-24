import pytest

from learning_resources.constants import (
    CONTENT_TYPE_FILE,
    CONTENT_TYPE_PAGE,
    PlatformType,
)
from learning_resources.content_summarizer import ContentSummarizer
from learning_resources.factories import (
    ContentFileFactory,
    ContentSummarizerConfigurationFactory,
    LearningResourceFactory,
    LearningResourceRunFactory,
)
from learning_resources.models import ContentFile

pytestmark = pytest.mark.django_db


@pytest.fixture
def mock_summarize_single_content_file(mocker):
    """Fixture for mocking the process single file method"""
    return mocker.patch(
        "learning_resources.content_summarizer.ContentSummarizer.summarize_single_content_file"
    )


@pytest.mark.parametrize(
    (
        "content",
        "content_extension",
        "allowed_extensions",
        "content_type",
        "allowed_content_types",
        "config_is_active",
        "expected_count",
    ),
    [
        (
            "Test content",
            ".srt",
            [".pdf"],
            CONTENT_TYPE_FILE,
            [CONTENT_TYPE_PAGE],
            True,
            0,
        ),
        (
            "Test content",
            ".srt",
            [".pdf"],
            CONTENT_TYPE_FILE,
            [CONTENT_TYPE_PAGE],
            False,
            0,
        ),
        (
            "Test content",
            ".srt",
            [".srt"],
            CONTENT_TYPE_FILE,
            [CONTENT_TYPE_FILE],
            False,
            0,
        ),
        ("Test content", ".srt", [""], CONTENT_TYPE_FILE, [CONTENT_TYPE_FILE], True, 0),
        ("Test content", ".srt", [""], CONTENT_TYPE_FILE, [""], True, 0),
        ("", ".srt", [".srt"], CONTENT_TYPE_FILE, [CONTENT_TYPE_FILE], True, 0),
        (
            "Test content",
            ".srt",
            [".srt"],
            CONTENT_TYPE_FILE,
            [CONTENT_TYPE_FILE],
            True,
            1,
        ),
        (
            "Test content",
            ".sjson",
            [".sjson"],
            CONTENT_TYPE_FILE,
            [CONTENT_TYPE_FILE],
            True,
            1,
        ),
    ],
)
def test_get_unprocessed_content_file_ids(  # noqa: PLR0913
    content,
    content_extension,
    allowed_extensions,
    content_type,
    allowed_content_types,
    config_is_active,
    expected_count,
):
    """The summarizer should process content files that are processable"""
    summarizer = ContentSummarizer()
    ContentFile.objects.all().delete()
    summarizer_config = ContentSummarizerConfigurationFactory.create(
        allowed_extensions=allowed_extensions,
        allowed_content_types=allowed_content_types,
        is_active=config_is_active,
        llm_model="test",
    )
    learning_resource_run = LearningResourceRunFactory.create(
        learning_resource__platform=summarizer_config.platform
    )
    content_file = ContentFileFactory.create(
        content=content,
        file_extension=content_extension,
        content_type=content_type,
        run=learning_resource_run,
    )
    unprocessed_file_ids = summarizer.get_unprocessed_content_file_ids(overwrite=False)
    if expected_count > 0:
        assert unprocessed_file_ids == [content_file.id]
    assert len(unprocessed_file_ids) == expected_count


@pytest.mark.parametrize("overwrite", [True, False])
def test_get_unprocessed_content_file_ids_with_overwrite(
    processable_content_files, overwrite
):
    """The summarizer should process content files that are processable"""
    summarizer = ContentSummarizer()
    for content_file in processable_content_files:
        content_file.summary = "Test summary"
        content_file.flashcards = [{"question": "question", "answer": "answer"}]
        content_file.save()

    unprocessed_file_ids = summarizer.get_unprocessed_content_file_ids(
        overwrite=overwrite
    )

    if overwrite:
        assert len(unprocessed_file_ids) == len(processable_content_files)
    else:
        assert len(unprocessed_file_ids) == 0


def test_get_unprocessed_content_file_ids_with_content_learning_res_ids(
    processable_content_files,
):
    """The summarizer should process content files that are processable"""
    summarizer = ContentSummarizer()

    def id_processable_content_files():
        return sorted([content_file.id for content_file in processable_content_files])

    unprocessed_file_ids = summarizer.get_unprocessed_content_file_ids(
        overwrite=False, content_file_ids=[], learning_resource_ids=[]
    )
    assert sorted(unprocessed_file_ids) == id_processable_content_files()

    learning_resource = LearningResourceFactory.create(
        platform=processable_content_files[0].run.learning_resource.platform
    )
    for content_file in processable_content_files:
        content_file.run.learning_resource = learning_resource
        content_file.run.save()

    unprocessed_file_ids = summarizer.get_unprocessed_content_file_ids(
        overwrite=False,
        content_file_ids=[],
        learning_resource_ids=[learning_resource.id],
    )
    assert sorted(unprocessed_file_ids) == id_processable_content_files()

    unprocessed_file_ids = summarizer.get_unprocessed_content_file_ids(
        overwrite=False,
        content_file_ids=[
            content_file.id for content_file in processable_content_files
        ],
        learning_resource_ids=[learning_resource.id],
    )
    assert sorted(unprocessed_file_ids) == id_processable_content_files()

    unprocessed_file_ids = summarizer.get_unprocessed_content_file_ids(
        overwrite=False,
        content_file_ids=[processable_content_files[0].id],
        learning_resource_ids=[learning_resource.id],
    )
    assert sorted(unprocessed_file_ids) == [processable_content_files[0].id]


@pytest.mark.parametrize(
    (
        "has_config",
        "config_platform_code",
        "config_active",
        "content_file_platform_code",
        "expect_results",
    ),
    [
        (True, PlatformType.xpro, False, PlatformType.edx, False),
        (True, PlatformType.edx, False, PlatformType.edx, False),
        (False, PlatformType.edx, False, PlatformType.edx, False),
        (True, PlatformType.edx, True, PlatformType.edx, True),
    ],
)
def test_get_unprocessed_content_files_with_platform_and_config(
    has_config,
    config_platform_code,
    config_active,
    content_file_platform_code,
    expect_results,
):
    """Test the platform validity while running get_unprocessed_content_file_ids"""
    summarizer = ContentSummarizer()
    allowed_types = [CONTENT_TYPE_FILE]
    allowed_extensions = [".srt"]

    if has_config:
        ContentSummarizerConfigurationFactory.create(
            allowed_extensions=allowed_extensions,
            allowed_content_types=allowed_types,
            is_active=config_active,
            llm_model="test",
            platform__code=config_platform_code.name,
        )
    learning_resource_run = LearningResourceRunFactory.create(
        learning_resource__platform__code=content_file_platform_code.name
    )
    ContentFileFactory.create(
        content="Test content",
        file_extension=allowed_extensions[0],
        content_type=allowed_types[0],
        run=learning_resource_run,
    )

    unprocessed_file_ids = summarizer.get_unprocessed_content_file_ids(overwrite=False)

    assert (
        len(unprocessed_file_ids) > 0
        if expect_results
        else len(unprocessed_file_ids) == 0
    )


def test_summarize_content_files_by_ids(
    processable_content_files, mock_summarize_single_content_file
):
    """The summarizer should process content files that are processable"""
    summarizer = ContentSummarizer()
    summarizer.summarize_content_files_by_ids(
        overwrite=False,
        content_file_ids=[
            content_file.id for content_file in processable_content_files
        ],
    )
    assert mock_summarize_single_content_file.call_count == len(
        processable_content_files
    )


def test_summarize_single_content_file(mocker, processable_content_files):
    """summarize_single_content_file should process the content file with the given id"""
    summarizer = ContentSummarizer()

    can_process_content_file_mock = mocker.patch.object(
        ContentSummarizer, "_can_process_content_file"
    )
    generate_summary_mock = mocker.patch.object(
        ContentSummarizer, "_generate_summary", return_value="This is a test summary"
    )
    generate_flashcards_mock = mocker.patch.object(
        ContentSummarizer,
        "_generate_flashcards",
        return_value=[{"question": "question", "answer": "answer"}],
    )

    summarizer.summarize_single_content_file(
        processable_content_files[0].id, overwrite=False
    )

    can_process_content_file_mock.assert_called_once()
    generate_summary_mock.assert_called_once()
    generate_flashcards_mock.assert_called_once()


@pytest.mark.parametrize(
    ("has_summary", "has_flashcards"),
    [(True, True), (False, True), (True, False), (False, False)],
)
def test_process_single_file_calls_llm_summary(
    mocker,
    settings,
    processable_content_files,
    has_summary,
    has_flashcards,
):
    """summarize_single_content_file should call the invoke function with the content"""
    settings.OPENAI_API_KEY = "test"
    summarizer = ContentSummarizer()
    # Mock the ChatLiteLLM class and its methods
    mock_chat_llm = mocker.patch(
        "learning_resources.content_summarizer.ChatLiteLLM", autospec=True
    )
    mock_instance = mock_chat_llm.return_value

    mock_summary_response = mocker.MagicMock()
    mock_summary_response.content = "mocked summary"
    # Mock the response for _generate_summary
    mock_instance.invoke.return_value = mock_summary_response

    # Mock the response for _generate_flashcards
    mock_instance.with_structured_output.return_value.invoke.return_value = {
        "flashcards": [
            {
                "question": "Generated Question",
                "answer": "Generated Answer",
            }
        ]
    }
    content_file = processable_content_files[0]
    if has_flashcards:
        content_file.flashcards = [{"Test": "Test"}]
    if has_summary:
        content_file.summary = "Test Summary"

    content_file.save()
    # Call the method under test
    summarizer.summarize_single_content_file(content_file.id, overwrite=False)

    # Assertions
    if has_summary and has_flashcards:
        assert mock_instance.with_structured_output.call_count == 0
        assert mock_instance.invoke.call_count == 0
    elif has_summary:
        assert mock_instance.with_structured_output.call_count == 1
    elif has_flashcards:
        assert mock_instance.invoke.call_count == 1
