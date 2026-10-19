"""Tests for generating a unit's course profile claims"""

import re

import pytest
from langchain_core.messages import AIMessage

from learning_resources.course_profile import unit_claims
from learning_resources.course_profile.schemas import UnitExtraction
from learning_resources.course_profile.unit_claims import (
    ClaimExtractionError,
    call_llm,
    generate_unit_claims,
    load_unit_stage,
)
from learning_resources.factories import (
    ContentFileFactory,
    LearningResourceRunFactory,
    UnitContentFileFactory,
    UnitFactory,
)
from learning_resources.models import (
    ClaimExtraction,
    CourseProfileConfiguration,
    Unit,
)

pytestmark = pytest.mark.django_db

_SOURCE = re.compile(r"^=== SOURCE (S\d+) \|.*===\n(.*)$", re.MULTILINE)


def _unit_out(prompt):
    """Return an extraction quoting the first line of the prompt's first source"""
    source_id, text = _SOURCE.findall(prompt)[0]
    return UnitExtraction.model_validate(
        {
            "summary": "The unit teaches forces.",
            "concepts": [
                {
                    "label": "Newton's second law",
                    "description": "Force equals mass times acceleration",
                    "kind": "concept",
                    "teaching_status": "taught",
                    "evidence": [
                        {"source_id": source_id, "passage": text, "locator": None}
                    ],
                }
            ],
            "skills": [
                {
                    "label": "Draw a free-body diagram",
                    "description": "Draw the forces on a body",
                    "evidence": [
                        {
                            "source_id": source_id,
                            "passage": "Words that appear nowhere in the source text",
                            "locator": None,
                        }
                    ],
                }
            ],
            "assumed_knowledge": [],
            "assessment_expectations": [],
            "extraction_notes": [],
        }
    )


@pytest.fixture
def fake_llm(mocker):
    """Replace the model with one that answers from the prompt"""
    return mocker.patch.object(
        unit_claims,
        "call_llm",
        side_effect=lambda _stage, prompt: (_unit_out(prompt), "unit raw"),
    )


@pytest.fixture(autouse=True)
def configuration():
    """Configure the unit stage"""
    CourseProfileConfiguration.objects.update_or_create(
        stage=CourseProfileConfiguration.Stage.UNIT,
        defaults={
            "llm_model": "test-model",
            "prompt": "unit prompt",
            "max_file_tokens": 25000,
            "input_token_budget": 100000,
        },
    )


def _add_file(unit, text, position=0):
    content_file = ContentFileFactory.create(
        run=unit.run,
        content=text,
        title=text[:20],
        content_type="file",
        file_type="application/pdf",
    )
    UnitContentFileFactory.create(
        unit=unit, content_file=content_file, position=position
    )
    return content_file


def _build_unit(run=None, **kwargs):
    unit = UnitFactory.create(
        run=run or LearningResourceRunFactory.create(),
        external_id="seq0",
        title="Week 0",
        **kwargs,
    )
    _add_file(
        unit, "Lecture: the net force on a body equals its mass times acceleration."
    )
    _add_file(unit, "Problem set: find the acceleration of each block.", position=1)
    return unit


def _prompt(fake_llm, call=0):
    return fake_llm.call_args_list[call].args[1]


def test_generate_unit_claims(fake_llm):
    """A unit's files are sent in one call, and the verified output is stored"""
    unit = _build_unit()

    extraction = generate_unit_claims(unit)

    prompt = _prompt(fake_llm)
    assert f"Title: {unit.run.learning_resource.title}" in prompt
    assert "title='Week 0' | kind=unit" in prompt
    assert prompt.index("=== SOURCE S01") < prompt.index("=== SOURCE S02")
    assert extraction.unit == unit
    assert extraction.level == ClaimExtraction.Level.UNIT
    assert extraction.model == "test-model"
    assert extraction.extractor_version.startswith("unit-")
    assert extraction.raw_response == "unit raw"
    output = extraction.output
    assert [source["source_id"] for source in output["sources"]] == ["S01", "S02"]
    concept = output["concepts"][0]
    assert concept["id"] == "c1"
    assert concept["evidence"][0]["verified"] == "exact"
    assert output["skills"][0]["id"] == "s1"
    assert output["skills"][0]["evidence"][0]["verified"] == "unverified"


def test_bin_prompt(fake_llm):
    """A bin's prompt says its files have no order"""
    generate_unit_claims(_build_unit(kind=Unit.Kind.BIN, position=None))

    assert "not part of a course unit" in _prompt(fake_llm)


def test_generate_unit_claims_cached(fake_llm):
    """A unit whose inputs haven't changed makes no call"""
    unit = _build_unit()
    extraction = generate_unit_claims(unit)

    assert generate_unit_claims(unit) == extraction
    assert fake_llm.call_count == 1


def test_identical_unit_in_other_run_reuses_extraction(fake_llm):
    """Another run's unit with the same files reuses the extraction"""
    unit = _build_unit()
    extraction = generate_unit_claims(unit)
    other_run = LearningResourceRunFactory.create(
        learning_resource=unit.run.learning_resource
    )

    assert generate_unit_claims(_build_unit(other_run)) == extraction
    assert fake_llm.call_count == 1


def test_changed_file_reruns_unit(fake_llm):
    """A changed file makes a new call"""
    unit = _build_unit()
    first = generate_unit_claims(unit)
    _add_file(unit, "An added worked example.", position=2)

    assert generate_unit_claims(unit) != first
    assert fake_llm.call_count == 2


def test_prompt_change_reruns_unit(fake_llm):
    """Editing the unit prompt makes a new call"""
    unit = _build_unit()
    first = generate_unit_claims(unit)
    CourseProfileConfiguration.objects.update(prompt="new prompt")

    assert generate_unit_claims(unit) != first
    assert fake_llm.call_count == 2


def test_truncated_files_noted(fake_llm):
    """Files over the per-file limit are truncated and listed in the notes"""
    CourseProfileConfiguration.objects.update(max_file_tokens=10)
    unit = UnitFactory.create()
    _add_file(unit, "A long transcript. " * 20)

    output = generate_unit_claims(unit).output

    assert output["sources"][0]["truncated"] is True
    assert output["extraction_notes"] == [
        "S01 was truncated: 40 of 379 characters were read"
    ]


def test_unit_over_budget_skipped(fake_llm):
    """A unit whose files are over the input budget makes no call"""
    CourseProfileConfiguration.objects.update(input_token_budget=30)

    assert generate_unit_claims(_build_unit()) is None
    fake_llm.assert_not_called()


def test_unit_without_text_skipped(fake_llm):
    """A unit with no file text makes no call"""
    unit = UnitFactory.create()
    _add_file(unit, "   ")

    assert generate_unit_claims(unit) is None
    fake_llm.assert_not_called()


def test_failed_call_stores_nothing(mocker):
    """A call that fails raises and stores nothing"""
    mocker.patch.object(
        unit_claims, "call_llm", side_effect=ClaimExtractionError("bad response")
    )

    with pytest.raises(ClaimExtractionError):
        generate_unit_claims(_build_unit())
    assert not ClaimExtraction.objects.exists()


def test_missing_configuration():
    """Generation needs the unit stage configured"""
    CourseProfileConfiguration.objects.all().delete()
    with pytest.raises(ClaimExtractionError, match="unit"):
        load_unit_stage()


def test_call_llm_retries_invalid_response(mocker, settings):
    """A response that doesn't validate is requested again"""
    settings.COURSE_PROFILE_LLM_ATTEMPTS = 2
    stage = load_unit_stage()
    output = _unit_out("=== SOURCE S01 | x ===\nsome source text here")
    raw = AIMessage(
        content="",
        additional_kwargs={
            "tool_calls": [{"function": {"arguments": '{"summary": 1}'}}]
        },
    )
    structured = mocker.Mock()
    structured.invoke.side_effect = [
        {"raw": raw, "parsed": None, "parsing_error": ValueError("bad")},
        {"raw": raw, "parsed": output, "parsing_error": None},
    ]
    chat = mocker.patch.object(unit_claims, "ChatLiteLLM")
    chat.return_value.with_structured_output.return_value = structured

    assert call_llm(stage, "combined prompt") == (output, '{"summary": 1}')
    chat.assert_called_once_with(
        model="test-model",
        temperature=0.0,
        max_tokens=stage.config.max_output_tokens,
        api_base=settings.LITELLM_API_BASE,
        request_timeout=settings.COURSE_PROFILE_LLM_TIMEOUT,
    )
    chat.return_value.with_structured_output.assert_called_once_with(
        UnitExtraction, method="function_calling", include_raw=True
    )
    assert structured.invoke.call_count == 2


def test_call_llm_gives_up(mocker, settings):
    """call_llm raises when no response validates"""
    settings.COURSE_PROFILE_LLM_ATTEMPTS = 2
    structured = mocker.Mock()
    structured.invoke.return_value = {
        "raw": AIMessage(content="no"),
        "parsed": None,
        "parsing_error": ValueError("bad"),
    }
    chat = mocker.patch.object(unit_claims, "ChatLiteLLM")
    chat.return_value.with_structured_output.return_value = structured

    with pytest.raises(ClaimExtractionError, match="after 2 attempt"):
        call_llm(load_unit_stage(), "combined prompt")
