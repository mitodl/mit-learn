"""Tests for credential metadata generation"""

import asyncio
import json

import pytest

from learning_resources.constants import CredentialMetadataField
from learning_resources.credentials import (
    FIELDS_USING_CONTENT_FILES,
    RESPONSE_SCHEMAS,
    BadgeCriteria,
    BadgeDescription,
    CredentialContext,
    _prepare_marketing_page,
    build_credential_context,
    generate_credential_metadata,
)
from learning_resources.etl.constants import MARKETING_PAGE_FILE_TYPE
from learning_resources.factories import (
    ContentFileFactory,
    CredentialMetadataConfigurationFactory,
    LearningResourceFactory,
)
from learning_resources.models import (
    CredentialMetadataConfiguration,
    CredentialMetadataGenerationLog,
)
from main.factories import UserFactory

# Shaped like a real scraped program page: the program's own instructors come
# before every child course's content, and the site footer trails the last
# instructor bio under no heading of its own.
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

## Program Contents

### Advanced Fluids

## What you will learn

- Derive the Navier-Stokes equations

## Meet your instructors

### Prof. Someone Else

Holder of 12 patents, none of them a skill the learner gained.

Massachusetts Institute of Technology
[Terms of Service](/terms)
\u00a9 2026 Massachusetts Institute of Technology
"""

LLM_RESPONSES = {
    BadgeDescription: {"description": "A course about modelling fluid flow."},
    BadgeCriteria: {"criteria": ["Applied conservation laws", "Modelled fluid flow"]},
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
    settings.CREDENTIAL_METADATA_CONTENT_CHUNK_LIMIT = 10
    settings.CREDENTIAL_METADATA_MIN_CHUNK_CHARS = 20
    return settings


@pytest.fixture
def mock_llm(mocker):
    """
    Return an LLM whose structured output is canned per response schema.

    `prompts` maps each response schema to the prompt it was sent, so a test
    can assert what a given field's generator actually saw.
    """

    def with_structured_output(schema):
        async def ainvoke(prompt):
            llm.prompts[schema] = prompt
            return LLM_RESPONSES[schema]

        runnable = mocker.Mock()
        runnable.ainvoke = ainvoke
        return runnable

    llm = mocker.Mock()
    llm.prompts = {}
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
            field=field.name,
            prompt=f"Generate the {field.name}.",
            retrieval_query=(
                "syllabus" if field.name in FIELDS_USING_CONTENT_FILES else ""
            ),
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
    """Every instructor section goes, wherever on the page it appears"""
    prepared = _prepare_marketing_page(MARKETING_PAGE)
    assert "Apply conservation laws" in prepared
    assert "Prof. Somebody" not in prepared
    assert "40 papers" not in prepared
    assert "Prof. Someone Else" not in prepared
    assert "12 patents" not in prepared


def test_prepare_marketing_page_keeps_content_after_an_instructor_section():
    """
    An instructor heading is not the end of the page.

    A program page carries the program's own instructors ahead of every child
    course's content; cutting the tail at that heading threw all of it away.
    """
    prepared = _prepare_marketing_page(MARKETING_PAGE)
    assert "## Program Contents" in prepared
    assert "Advanced Fluids" in prepared
    assert "Derive the Navier-Stokes equations" in prepared


def test_prepare_marketing_page_keeps_content_after_a_footer():
    """
    A copyright line does not mean the page is over.

    A program page concatenates its child courses' pages, so the first child's
    footer sits in the middle of it.
    """
    page = (
        MARKETING_PAGE
        + """
\u00a9 2026 Massachusetts Institute of Technology

## What you will learn

- Solve the heat equation
"""
    )
    prepared = _prepare_marketing_page(page)
    assert "Solve the heat equation" in prepared


def test_prepare_marketing_page_drops_prerequisites():
    """
    Prerequisites are the opposite of an outcome.

    Left in, the model reported prerequisite mathematics as a skill the learner
    gained on completion.
    """
    prepared = _prepare_marketing_page(MARKETING_PAGE)
    assert "Multivariable calculus" not in prepared
    assert "Prerequisites" not in prepared


@pytest.mark.parametrize("content", ["", "   \n  "])
def test_prepare_marketing_page_empty(content):
    """An empty page contributes no section at all"""
    assert _prepare_marketing_page(content) == ""


@pytest.mark.django_db(transaction=True)
def test_build_credential_context_uses_every_source(resource, mock_retrieval):
    """Context should carry resource metadata, the marketing page and chunks"""
    context = asyncio.run(build_credential_context(resource, "syllabus"))

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
def test_metadata_is_json_keyed_by_field(resource, mock_retrieval):
    """The metadata block is JSON, so every value arrives labelled"""
    run = resource.best_run
    run.description = "What this particular run covers."
    run.save()

    context = asyncio.run(build_credential_context(resource, "syllabus"))
    values = json.loads(context.metadata.removeprefix("## Course information\n"))

    assert values["title"] == resource.title
    assert values["readable_id"] == resource.readable_id
    assert values["description"] == resource.description
    assert values["run_description"] == "What this particular run covers."
    assert values["topics"] == [topic.name for topic in resource.topics.all()]
    # Empty fields are dropped rather than sent as blanks, and the url is
    # never sent at all.
    assert "url" not in values
    assert all(value for value in values.values())


@pytest.mark.django_db(transaction=True)
def test_build_credential_context_without_marketing_page(mock_retrieval):
    """A resource with no marketing page still gets a context"""
    resource = LearningResourceFactory.create(is_course=True)
    context = asyncio.run(build_credential_context(resource, "syllabus"))

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
    context = asyncio.run(build_credential_context(resource, "syllabus"))
    assert context.chunks == []


@pytest.mark.django_db(transaction=True)
def test_build_credential_context_survives_retrieval_failure(resource, mocker):
    """A Qdrant failure degrades the context instead of failing the request"""
    mocker.patch(
        "learning_resources.credentials.async_content_file_chunks_for_resource",
        side_effect=ConnectionError("qdrant is down"),
    )
    context = asyncio.run(build_credential_context(resource, "syllabus"))

    assert context.chunks == []
    assert "Apply conservation laws" in context.marketing_page


def test_assemble_includes_every_source_highest_scoring_first():
    """Metadata, then the marketing page, then chunks in retrieval order"""
    context = CredentialContext(
        metadata="## Course information\n- Title: Fluids",
        marketing_page="## Marketing page\n\nAbout this course.",
        chunks=[
            ("first", "the highest scoring chunk"),
            ("second", "the next chunk"),
        ],
    )
    text, point_ids = context.assemble()

    assert text == (
        "## Course information\n- Title: Fluids\n\n"
        "## Marketing page\n\nAbout this course.\n\n"
        "the highest scoring chunk\n\n"
        "the next chunk"
    )
    assert point_ids == ["first", "second"]


def test_assemble_without_chunks():
    """Course information and the marketing page stand on their own"""
    context = CredentialContext(
        metadata="## Course information\n- Title: Fluids",
        marketing_page="## Marketing page\n\nAbout this course.",
        chunks=[("first", "the highest scoring chunk")],
    )
    text, point_ids = context.assemble(include_chunks=False)

    assert text == (
        "## Course information\n- Title: Fluids\n\n"
        "## Marketing page\n\nAbout this course."
    )
    assert point_ids == []


def test_assemble_omits_a_missing_marketing_page():
    """A resource with no marketing page leaves no empty gap in the context"""
    context = CredentialContext(
        metadata="## Course information\n- Title: Fluids",
        marketing_page="",
        chunks=[("chunk-1", "a chunk")],
    )
    text, point_ids = context.assemble()

    assert text == "## Course information\n- Title: Fluids\n\na chunk"
    assert point_ids == ["chunk-1"]


@pytest.mark.django_db(transaction=True)
def test_generate_credential_metadata(
    resource, configurations, mock_llm, mock_retrieval
):
    """Both fields are generated, each keyed by its field name"""
    user = UserFactory.create()
    metadata = asyncio.run(generate_credential_metadata(resource, user=user))

    assert metadata["description"] == "A course about modelling fluid flow."
    assert metadata["criteria"] == [
        "Applied conservation laws",
        "Modelled fluid flow",
    ]
    # One context, one call per field over it.
    assert mock_retrieval.call_count == 1


@pytest.mark.django_db(transaction=True)
def test_only_criteria_is_generated_from_course_content(
    resource, configurations, mock_llm, mock_retrieval
):
    """
    Retrieved content files go to the criteria prompt alone.

    Criteria are claims about what a learner did, so they need the course's own
    material. A description is 1-2 sentences about what the course is, which the
    metadata and marketing page already say.
    """
    asyncio.run(generate_credential_metadata(resource))

    chunk_text = "A syllabus chunk long enough to be kept."
    assert chunk_text in mock_llm.prompts[BadgeCriteria]
    assert chunk_text not in mock_llm.prompts[BadgeDescription]
    # Both still get everything the course says about itself.
    for prompt in mock_llm.prompts.values():
        assert resource.title in prompt
        assert "Apply conservation laws" in prompt


@pytest.mark.django_db(transaction=True)
def test_retrieval_query_comes_from_the_admin(
    resource, no_configurations, mock_llm, mock_retrieval
):
    """The query is whatever the criteria configuration says it is"""
    CredentialMetadataConfigurationFactory.create(
        field=CredentialMetadataField.criteria.name,
        retrieval_query="grading rubric and assessments",
    )

    asyncio.run(generate_credential_metadata(resource))

    mock_retrieval.assert_called_once_with(
        resource.readable_id, "grading rubric and assessments", limit=10
    )


@pytest.mark.django_db(transaction=True)
def test_a_blank_retrieval_query_retrieves_nothing(
    resource, no_configurations, mock_llm, mock_retrieval
):
    """There is no vector search to run without a query"""
    CredentialMetadataConfigurationFactory.create(
        field=CredentialMetadataField.criteria.name, retrieval_query=""
    )

    asyncio.run(generate_credential_metadata(resource))

    mock_retrieval.assert_not_called()
    assert mock_llm.prompts[BadgeCriteria]


@pytest.mark.django_db(transaction=True)
def test_description_only_generation_skips_retrieval(
    resource, no_configurations, mock_llm, mock_retrieval
):
    """
    With no field needing course content, Qdrant is never queried.

    Even with a query set on the description row: the query is read from the
    fields generated out of course content, not from whichever row has one.
    """
    CredentialMetadataConfigurationFactory.create(
        field=CredentialMetadataField.description.name,
        retrieval_query="syllabus",
    )

    asyncio.run(generate_credential_metadata(resource))

    mock_retrieval.assert_not_called()
    assert mock_llm.prompts[BadgeDescription]


@pytest.mark.django_db(transaction=True)
def test_generate_credential_metadata_logs_generations(
    resource, configurations, mock_llm, mock_retrieval
):
    """Every field generated appends a row recording how it was generated"""
    user = UserFactory.create()
    asyncio.run(generate_credential_metadata(resource, user=user))

    generations = CredentialMetadataGenerationLog.objects.filter(
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
        # Only the fields generated from course content record chunks.
        assert generation.retrieved_point_ids == (
            ["point-1"] if configuration.field in FIELDS_USING_CONTENT_FILES else []
        )
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
    assert metadata["description"] == "A course about modelling fluid flow."

    failure = CredentialMetadataGenerationLog.objects.get(
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
        BadgeCriteria: {"criteria": ["", None]},
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
    assert CredentialMetadataGenerationLog.objects.count() == len(configurations)


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
    assert not CredentialMetadataGenerationLog.objects.filter(
        field=configuration.field
    ).exists()


@pytest.mark.django_db(transaction=True)
def test_generate_credential_metadata_without_configurations(
    resource, no_configurations, mock_llm, mock_retrieval
):
    """With nothing configured there is nothing to generate, and no LLM call"""
    assert asyncio.run(generate_credential_metadata(resource)) == {}
    assert not CredentialMetadataGenerationLog.objects.exists()
    mock_llm.with_structured_output.assert_not_called()
