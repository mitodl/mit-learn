"""Tests for credential metadata generation"""

import asyncio

import pytest

from learning_resources.constants import CredentialMetadataField
from learning_resources.credentials import (
    RESPONSE_SCHEMAS,
    BadgeCriteria,
    BadgeDescription,
    CredentialContext,
    _prepare_marketing_page,
    build_credential_context,
    generate_credential_metadata,
    render_criteria_narrative,
)
from learning_resources.etl.constants import MARKETING_PAGE_FILE_TYPE
from learning_resources.factories import (
    ContentFileFactory,
    CredentialMetadataConfigurationFactory,
    LearningResourceFactory,
)
from learning_resources.models import (
    CredentialMetadataConfiguration,
    CredentialMetadataGeneration,
)
from main.factories import UserFactory

MARKETING_PAGE = """
## About this course

Learn to model fluid flow.

## What you will learn

- Apply conservation laws

## Prerequisites

Multivariable calculus

## Meet your instructors

### Prof. Somebody

Author of 40 papers on things irrelevant to this credential.
"""

LLM_RESPONSES = {
    BadgeDescription: {"description": "A course about modelling fluid flow."},
    BadgeCriteria: {"skills": ["Applied conservation laws", "Modelled fluid flow"]},
}


def chunk(content, **kwargs):
    """Build a retrieved content-file chunk payload"""
    return {
        "point_id": kwargs.pop("point_id", "point-1"),
        "chunk_content": content,
        "title": "Syllabus",
        "file_extension": ".html",
        "file_type": "text",
        **kwargs,
    }


@pytest.fixture(autouse=True)
def credential_settings(settings):
    """Point retrieval at a fixed query and leave it enabled"""
    settings.CREDENTIAL_METADATA_RETRIEVAL_ENABLED = True
    settings.CREDENTIAL_METADATA_RETRIEVAL_QUERY = "syllabus"
    settings.CREDENTIAL_METADATA_RETRIEVAL_LIMIT = 10
    settings.CREDENTIAL_METADATA_MIN_CHUNK_CHARS = 20
    return settings


@pytest.fixture
def mock_llm(mocker):
    """Return an LLM whose structured output is canned per response schema"""

    def with_structured_output(schema):
        runnable = mocker.Mock()
        runnable.ainvoke = mocker.AsyncMock(return_value=LLM_RESPONSES[schema])
        return runnable

    llm = mocker.Mock()
    llm.with_structured_output.side_effect = with_structured_output
    mocker.patch("learning_resources.credentials._get_llm", return_value=llm)
    return llm


@pytest.fixture
def mock_retrieval(mocker):
    """Mock the Qdrant content-file retrieval"""
    return mocker.patch(
        "learning_resources.credentials.async_content_file_chunks_for_resource",
        return_value=[chunk("A syllabus chunk long enough to be kept.")],
    )


@pytest.fixture
def no_configurations():
    """
    Empty the configuration table.

    Migration 0125 seeds one configuration per field, and a
    django_db(transaction=True) test flushes those rows without restoring them
    -- so whether a test finds them depends on test order. Every test that
    cares about which configurations exist starts from here.
    """
    CredentialMetadataConfiguration.objects.all().delete()


@pytest.fixture
def configurations(no_configurations):
    """One active configuration per credential metadata field"""
    return [
        CredentialMetadataConfigurationFactory.create(
            field=field.name, prompt=f"Generate the {field.name}."
        )
        for field in CredentialMetadataField
    ]


@pytest.fixture
def resource():
    """Return a course with a marketing page"""
    resource = LearningResourceFactory.create(is_course=True)
    ContentFileFactory.create(
        learning_resource=resource,
        file_type=MARKETING_PAGE_FILE_TYPE,
        content=MARKETING_PAGE,
        published=True,
    )
    return resource


def test_prepare_marketing_page_drops_instructors():
    """Everything from the instructors heading on should be cut"""
    prepared = _prepare_marketing_page(MARKETING_PAGE)
    assert "Apply conservation laws" in prepared
    assert "Prof. Somebody" not in prepared
    assert "40 papers" not in prepared


def test_prepare_marketing_page_relabels_prerequisites():
    """Prerequisites must be labelled as entry requirements, not outcomes"""
    prepared = _prepare_marketing_page(MARKETING_PAGE)
    assert "Multivariable calculus" in prepared
    assert "## Prerequisites\n" not in prepared
    assert "NOT skills gained" in prepared


@pytest.mark.parametrize("content", ["", "   \n  "])
def test_prepare_marketing_page_empty(content):
    """An empty page contributes no section at all"""
    assert _prepare_marketing_page(content) == ""


@pytest.mark.django_db(transaction=True)
def test_build_credential_context_uses_every_source(resource, mock_retrieval):
    """Context should carry resource metadata, the marketing page and chunks"""
    context = asyncio.run(build_credential_context(resource))

    assert resource.title in context.metadata
    assert resource.readable_id in context.metadata
    # The url is deliberately excluded: with it in context the model invented
    # criteria URIs from it.
    assert resource.url not in context.metadata
    assert "Apply conservation laws" in context.marketing_page
    assert context.chunks == [
        (
            "point-1",
            "### Course content: Syllabus\n\nA syllabus chunk long enough to be kept.",
        )
    ]
    mock_retrieval.assert_called_once_with(resource.readable_id, "syllabus", limit=10)


@pytest.mark.django_db(transaction=True)
def test_build_credential_context_without_marketing_page(mock_retrieval):
    """A resource with no marketing page still gets a context"""
    resource = LearningResourceFactory.create(is_course=True)
    context = asyncio.run(build_credential_context(resource))

    assert context.marketing_page == ""
    assert context.metadata
    assert len(context.chunks) == 1


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize(
    "unusable",
    [
        {"chunk_content": "too short"},
        {"file_extension": ".xml"},
        {"file_extension": ".sjson"},
        {"file_type": MARKETING_PAGE_FILE_TYPE},
    ],
)
def test_build_credential_context_filters_chunks(resource, mocker, unusable):
    """Stub blocks, structure markup and the marketing page are not chunks"""
    payload = chunk("A syllabus chunk long enough to be kept.", **unusable)
    mocker.patch(
        "learning_resources.credentials.async_content_file_chunks_for_resource",
        return_value=[payload],
    )
    context = asyncio.run(build_credential_context(resource))
    assert context.chunks == []


@pytest.mark.django_db(transaction=True)
def test_build_credential_context_survives_retrieval_failure(resource, mocker):
    """A Qdrant failure degrades the context instead of failing the request"""
    mocker.patch(
        "learning_resources.credentials.async_content_file_chunks_for_resource",
        side_effect=ConnectionError("qdrant is down"),
    )
    context = asyncio.run(build_credential_context(resource))

    assert context.chunks == []
    assert "Apply conservation laws" in context.marketing_page


@pytest.mark.django_db(transaction=True)
def test_build_credential_context_retrieval_kill_switch(
    resource, mock_retrieval, settings
):
    """CREDENTIAL_METADATA_RETRIEVAL_ENABLED=False skips Qdrant entirely"""
    settings.CREDENTIAL_METADATA_RETRIEVAL_ENABLED = False
    context = asyncio.run(build_credential_context(resource))

    assert context.chunks == []
    mock_retrieval.assert_not_called()


def test_assemble_keeps_metadata_and_fits_chunks():
    """Chunks are added highest scoring first, and only if they fit"""
    context = CredentialContext(
        metadata="## Course information\n- Title: Fluids",
        marketing_page="## Marketing page\n\nAbout this course.",
        chunks=[
            ("big", "word " * 500),
            ("small", "a short but useful chunk"),
        ],
    )
    text, point_ids = context.assemble(100, "gpt-4o-mini")

    assert context.metadata in text
    # The oversized chunk is skipped rather than ending the assembly, so the
    # smaller lower-scoring one still makes it in.
    assert point_ids == ["small"]
    assert "a short but useful chunk" in text


def test_assemble_truncates_marketing_page_to_budget():
    """The marketing page is cut to what the budget leaves after metadata"""
    context = CredentialContext(
        metadata="## Course information\n- Title: Fluids",
        marketing_page="page " * 500,
        chunks=[("chunk-1", "a chunk that cannot possibly fit")],
    )
    text, point_ids = context.assemble(60, "gpt-4o-mini")

    assert context.metadata in text
    assert point_ids == []
    assert len(text) < len(context.marketing_page)


def test_render_criteria_narrative():
    """Skills render as a markdown bullet list"""
    assert render_criteria_narrative(["First", "Second"]) == "- First\n- Second"


@pytest.mark.django_db(transaction=True)
def test_generate_credential_metadata(
    resource, configurations, mock_llm, mock_retrieval
):
    """Both fields are generated, with criteria rendered from skills"""
    user = UserFactory.create()
    metadata = asyncio.run(generate_credential_metadata(resource, user=user))

    assert metadata["description"] == "A course about modelling fluid flow."
    assert metadata["criteria_skills"] == [
        "Applied conservation laws",
        "Modelled fluid flow",
    ]
    assert metadata["criteria"] == (
        "- Applied conservation laws\n- Modelled fluid flow"
    )
    # One context, one call per field over it.
    assert mock_retrieval.call_count == 1


@pytest.mark.django_db(transaction=True)
def test_generate_credential_metadata_logs_generations(
    resource, configurations, mock_llm, mock_retrieval
):
    """Every field generated appends a row recording how it was generated"""
    user = UserFactory.create()
    asyncio.run(generate_credential_metadata(resource, user=user))

    generations = CredentialMetadataGeneration.objects.filter(
        learning_resource=resource
    )
    assert generations.count() == len(configurations)
    for configuration in configurations:
        generation = generations.get(field=configuration.field)
        assert (
            generation.response == LLM_RESPONSES[RESPONSE_SCHEMAS[configuration.field]]
        )
        # The prompt is snapshotted, not referenced: it is admin-editable, and
        # a response stored against a mutated prompt says nothing.
        assert generation.prompt_text == configuration.prompt
        assert generation.llm_model == configuration.llm_model
        assert generation.context_tokens > 0
        assert resource.title in generation.context_text
        assert generation.retrieved_point_ids == ["point-1"]
        assert generation.generated_by == user
        assert generation.error == ""
        assert generation.latency_ms is not None


@pytest.mark.django_db(transaction=True)
def test_generate_credential_metadata_records_a_failure(
    resource, configurations, mocker, mock_retrieval
):
    """A field whose call fails is logged and left out of the response"""

    def with_structured_output(schema):
        runnable = mocker.Mock()
        if schema is BadgeCriteria:
            runnable.ainvoke = mocker.AsyncMock(side_effect=ValueError("no criteria"))
        else:
            runnable.ainvoke = mocker.AsyncMock(return_value=LLM_RESPONSES[schema])
        return runnable

    llm = mocker.Mock()
    llm.with_structured_output.side_effect = with_structured_output
    mocker.patch("learning_resources.credentials._get_llm", return_value=llm)

    metadata = asyncio.run(generate_credential_metadata(resource))

    # Absent rather than empty, so a caller cannot overwrite a good value with
    # a blank one.
    assert "criteria" not in metadata
    assert "criteria_skills" not in metadata
    assert metadata["description"] == "A course about modelling fluid flow."

    failure = CredentialMetadataGeneration.objects.get(
        learning_resource=resource, field=CredentialMetadataField.criteria.name
    )
    assert failure.response is None
    assert "no criteria" in failure.error


@pytest.mark.django_db(transaction=True)
def test_generate_credential_metadata_omits_empty_values(
    resource, configurations, mocker, mock_retrieval
):
    """An empty draft is left out rather than returned as a blank field"""
    empty = {
        BadgeDescription: {"description": ""},
        BadgeCriteria: {"skills": ["", None]},
    }

    def with_structured_output(schema):
        runnable = mocker.Mock()
        runnable.ainvoke = mocker.AsyncMock(return_value=empty[schema])
        return runnable

    llm = mocker.Mock()
    llm.with_structured_output.side_effect = with_structured_output
    mocker.patch("learning_resources.credentials._get_llm", return_value=llm)

    assert asyncio.run(generate_credential_metadata(resource)) == {}
    # The empty responses are still logged: what the model returned is the
    # point of the record.
    assert CredentialMetadataGeneration.objects.count() == len(configurations)


@pytest.mark.django_db(transaction=True)
def test_generate_credential_metadata_skips_inactive_configurations(
    resource, configurations, mock_llm, mock_retrieval
):
    """An inactive configuration generates nothing for its field"""
    configuration = configurations[0]
    configuration.is_active = False
    configuration.save()

    metadata = asyncio.run(generate_credential_metadata(resource))

    assert configuration.field not in metadata
    assert not CredentialMetadataGeneration.objects.filter(
        field=configuration.field
    ).exists()


@pytest.mark.django_db(transaction=True)
def test_generate_credential_metadata_without_configurations(
    resource, no_configurations, mock_llm, mock_retrieval
):
    """With nothing configured there is nothing to generate, and no LLM call"""
    assert asyncio.run(generate_credential_metadata(resource)) == {}
    assert not CredentialMetadataGeneration.objects.exists()
    mock_llm.with_structured_output.assert_not_called()


@pytest.mark.django_db(transaction=True)
def test_generate_credential_metadata_applies_per_field_budget(
    resource, no_configurations, mock_llm, mock_retrieval
):
    """Each field's context is assembled against its own token budget"""
    CredentialMetadataConfigurationFactory.create(
        field=CredentialMetadataField.description.name,
        max_context_tokens=30,
    )
    CredentialMetadataConfigurationFactory.create(
        field=CredentialMetadataField.criteria.name,
        max_context_tokens=2000,
    )
    asyncio.run(generate_credential_metadata(resource))

    description, criteria = (
        CredentialMetadataGeneration.objects.get(field=field).context_tokens
        for field in (
            CredentialMetadataField.description.name,
            CredentialMetadataField.criteria.name,
        )
    )
    assert description <= 30
    assert criteria > description
