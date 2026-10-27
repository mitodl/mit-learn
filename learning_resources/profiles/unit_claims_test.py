"""Tests for generating a unit's resource profile claims"""

import re
from datetime import timedelta

import pytest
from langchain_core.messages import AIMessage

from learning_resources.factories import (
    ContentFileFactory,
    LearningResourceRunFactory,
    UnitContentFileFactory,
    UnitFactory,
)
from learning_resources.models import (
    ClaimExtraction,
    ResourceProfileConfiguration,
    Unit,
)
from learning_resources.profiles import unit_claims
from learning_resources.profiles.schemas import UnitExtraction
from learning_resources.profiles.unit_claims import (
    ClaimExtractionError,
    CourseContext,
    call_llm,
    generate_unit_claims,
    load_unit_stage,
    title_context,
)
from main.utils import now_in_utc

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
    ResourceProfileConfiguration.objects.update_or_create(
        stage=ResourceProfileConfiguration.Stage.UNIT,
        defaults={
            "llm_model": "test-model",
            "prompt": "unit prompt",
            "max_file_tokens": 25000,
            "input_token_budget": 100000,
            "reasoning_effort": None,
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


def _generate(unit, **kwargs):
    """Generate a unit's claims with the course title as its context"""
    return generate_unit_claims(unit, title_context(unit.run), **kwargs)


def _prompt(fake_llm, call=0):
    return fake_llm.call_args_list[call].args[1]


def test_generate_unit_claims(fake_llm):
    """A unit's files are sent in one call, and the verified output is stored"""
    unit = _build_unit()

    extraction = _generate(unit)

    prompt = _prompt(fake_llm)
    assert f"Title: {unit.run.learning_resource.title}" in prompt
    assert "title='Week 0' | kind=unit" in prompt
    assert prompt.index("=== SOURCE S01") < prompt.index("=== SOURCE S02")
    assert extraction.unit == unit
    assert extraction.level == ClaimExtraction.Level.UNIT
    assert extraction.model == "test-model"
    config = ResourceProfileConfiguration.objects.get(stage="unit")
    assert extraction.extractor_version == (f"unit-{config.updated_on:%Y%m%dT%H%M%S}")
    assert extraction.raw_response == "unit raw"
    output = extraction.output
    assert [source["source_id"] for source in output["sources"]] == ["S01", "S02"]
    concept = output["concepts"][0]
    assert concept["id"] == "c1"
    assert concept["evidence"][0]["verified"] == "exact"
    assert output["skills"][0]["id"] == "s1"
    assert output["skills"][0]["evidence"][0]["verified"] == "unverified"


def test_context_in_prompt_and_key(fake_llm):
    """The context's digest is in the prompt, and its key in the cache key"""
    unit = _build_unit()
    first = generate_unit_claims(unit, CourseContext("a" * 64, "Outline: Week 0"))

    assert "Outline: Week 0" in _prompt(fake_llm)
    assert generate_unit_claims(unit, CourseContext("a" * 64, "Outline")) == first
    assert generate_unit_claims(unit, CourseContext("b" * 64, "Outline")) != first
    assert fake_llm.call_count == 2


def test_bin_prompt(fake_llm):
    """A bin's prompt says its files have no order"""
    _generate(_build_unit(kind=Unit.Kind.BIN, position=None))

    assert "not part of a course unit" in _prompt(fake_llm)


def test_generate_unit_claims_cached(fake_llm):
    """A unit whose inputs haven't changed makes no call"""
    unit = _build_unit()
    extraction = _generate(unit)

    assert _generate(unit) == extraction
    assert fake_llm.call_count == 1


def test_overwrite_reruns_unit(fake_llm):
    """Overwrite makes a new call and replaces the stored extraction"""
    unit = _build_unit()
    first = _generate(unit)
    ClaimExtraction.objects.filter(pk=first.pk).update(output={"stale": True})

    extraction = _generate(unit, overwrite=True)

    assert extraction.pk == first.pk
    assert extraction.output["summary"] == "The unit teaches forces."
    assert ClaimExtraction.objects.count() == 1
    assert fake_llm.call_count == 2


def test_identical_unit_in_other_run_reuses_extraction(fake_llm):
    """Another run's unit with the same files reuses the extraction"""
    unit = _build_unit()
    extraction = _generate(unit)
    other_run = LearningResourceRunFactory.create(
        learning_resource=unit.run.learning_resource
    )

    assert _generate(_build_unit(other_run)) == extraction
    assert fake_llm.call_count == 1


def test_changed_file_reruns_unit(fake_llm):
    """A changed file makes a new call"""
    unit = _build_unit()
    first = _generate(unit)
    _add_file(unit, "An added worked example.", position=2)

    assert _generate(unit) != first
    assert fake_llm.call_count == 2


@pytest.mark.parametrize(
    "change", [{"prompt": "new prompt"}, {"llm_model": "other-model"}]
)
def test_configuration_change_keeps_claims(fake_llm, change):
    """Editing the unit configuration reuses the stored claims"""
    unit = _build_unit()
    first = _generate(unit)
    ResourceProfileConfiguration.objects.update(**change)

    assert _generate(unit) == first
    assert fake_llm.call_count == 1


def test_prompt_change_applied_with_overwrite(fake_llm):
    """A prompt change reaches stored claims when they are overwritten"""
    unit = _build_unit()
    first = _generate(unit)
    # update() skips auto_now, so move updated_on past the first version
    ResourceProfileConfiguration.objects.update(
        prompt="new prompt", updated_on=now_in_utc() + timedelta(minutes=1)
    )

    extraction = _generate(unit, overwrite=True)

    assert extraction.pk == first.pk
    assert extraction.extractor_version != first.extractor_version
    assert fake_llm.call_count == 2


def test_truncated_files_noted(fake_llm):
    """Files over the per-file limit are truncated and listed in the notes"""
    ResourceProfileConfiguration.objects.update(max_file_tokens=10)
    unit = UnitFactory.create()
    _add_file(unit, "A long transcript. " * 20)

    output = _generate(unit).output

    assert output["sources"][0]["truncated"] is True
    assert output["extraction_notes"] == [
        "S01 was truncated: 40 of 379 characters were read"
    ]


def test_unit_over_budget_skipped(fake_llm):
    """A unit whose files are over the input budget makes no call"""
    ResourceProfileConfiguration.objects.update(input_token_budget=30)

    assert _generate(_build_unit()) is None
    fake_llm.assert_not_called()


def test_unit_without_text_skipped(fake_llm):
    """A unit with no file text makes no call"""
    unit = UnitFactory.create()
    _add_file(unit, "   ")

    assert _generate(unit) is None
    fake_llm.assert_not_called()


def test_failed_call_stores_nothing(mocker):
    """A call that fails raises and stores nothing"""
    mocker.patch.object(
        unit_claims, "call_llm", side_effect=ClaimExtractionError("bad response")
    )

    with pytest.raises(ClaimExtractionError):
        _generate(_build_unit())
    assert not ClaimExtraction.objects.exists()


def test_missing_configuration():
    """Generation needs the unit stage configured"""
    ResourceProfileConfiguration.objects.all().delete()
    with pytest.raises(ClaimExtractionError, match="unit"):
        load_unit_stage()


def test_call_llm(mocker, settings):
    """call_llm returns the parsed output and the raw tool call arguments"""
    stage = load_unit_stage()
    output = _unit_out("=== SOURCE S01 | x ===\nsome source text here")
    raw = AIMessage(
        content="",
        additional_kwargs={
            "tool_calls": [{"function": {"arguments": '{"summary": 1}'}}]
        },
    )
    structured = mocker.Mock()
    structured.invoke.return_value = {
        "raw": raw,
        "parsed": output,
        "parsing_error": None,
    }
    chat = mocker.patch.object(unit_claims, "ChatLiteLLM")
    chat.return_value.with_structured_output.return_value = structured

    assert call_llm(stage, "combined prompt") == (output, '{"summary": 1}')
    chat.assert_called_once_with(
        model="test-model",
        temperature=None,
        max_tokens=None,
        model_kwargs={},
        api_base=settings.LITELLM_API_BASE,
        request_timeout=settings.RESOURCE_PROFILE_LLM_TIMEOUT,
    )
    chat.return_value.with_structured_output.assert_called_once_with(
        UnitExtraction, method="function_calling", include_raw=True
    )
    assert structured.invoke.call_count == 1


def test_call_llm_with_parameters(mocker):
    """Configured parameters are sent to the model"""
    ResourceProfileConfiguration.objects.update(
        temperature=0.2,
        max_tokens=1000,
        max_completion_tokens=2000,
        reasoning_effort="low",
    )
    structured = mocker.Mock()
    structured.invoke.return_value = {
        "raw": AIMessage(content=""),
        "parsed": _unit_out("=== SOURCE S01 | x ===\nsome source text here"),
        "parsing_error": None,
    }
    chat = mocker.patch.object(unit_claims, "ChatLiteLLM")
    chat.return_value.with_structured_output.return_value = structured

    call_llm(load_unit_stage(), "combined prompt")

    kwargs = chat.call_args.kwargs
    assert kwargs["temperature"] == 0.2
    assert kwargs["max_tokens"] == 1000
    assert kwargs["model_kwargs"] == {
        "max_completion_tokens": 2000,
        "reasoning_effort": "low",
        "allowed_openai_params": ["reasoning_effort"],
    }


def test_call_llm_invalid_response(mocker):
    """A response that doesn't validate raises without a retry"""
    structured = mocker.Mock()
    structured.invoke.return_value = {
        "raw": AIMessage(content="no"),
        "parsed": None,
        "parsing_error": ValueError("bad"),
    }
    chat = mocker.patch.object(unit_claims, "ChatLiteLLM")
    chat.return_value.with_structured_output.return_value = structured

    with pytest.raises(ClaimExtractionError, match="no valid UnitExtraction"):
        call_llm(load_unit_stage(), "combined prompt")
    assert structured.invoke.call_count == 1


def _tool_message(args):
    return AIMessage(
        content="",
        tool_calls=[{"name": "UnitExtraction", "args": args, "id": "call1"}],
    )


def test_call_llm_drops_invalid_claims(mocker):
    """A response with invalid claims is kept, without them"""
    args = _unit_out("=== SOURCE S01 | x ===\nsome source text here").model_dump()
    bad_concept = {**args["concepts"][0], "label": "Torque", "kind": "principle"}
    args["concepts"].append(bad_concept)
    args["skills"][0]["evidence"][0]["passage"] = "x" * 701
    structured = mocker.Mock()
    structured.invoke.return_value = {
        "raw": _tool_message(args),
        "parsed": None,
        "parsing_error": ValueError("bad"),
    }
    chat = mocker.patch.object(unit_claims, "ChatLiteLLM")
    chat.return_value.with_structured_output.return_value = structured

    parsed, _ = call_llm(load_unit_stage(), "combined prompt")

    assert structured.invoke.call_count == 1
    assert [concept.label for concept in parsed.concepts] == ["Newton's second law"]
    assert parsed.skills == []
    assert len(parsed.extraction_notes) == 2
    assert parsed.extraction_notes[0].startswith(
        "Dropped concepts item 2 ('Torque'), which did not validate: kind:"
    )
    assert parsed.extraction_notes[1].startswith(
        "Dropped skills item 1 ('Draw a free-body diagram'), which did not"
        " validate: evidence.0.passage:"
    )


def test_call_llm_fails_when_only_claims_are_valid(mocker):
    """A response that is invalid apart from its claims raises"""
    args = _unit_out("=== SOURCE S01 | x ===\nsome source text here").model_dump()
    del args["summary"]
    structured = mocker.Mock()
    structured.invoke.return_value = {
        "raw": _tool_message(args),
        "parsed": None,
        "parsing_error": ValueError("bad"),
    }
    chat = mocker.patch.object(unit_claims, "ChatLiteLLM")
    chat.return_value.with_structured_output.return_value = structured

    with pytest.raises(ClaimExtractionError, match="summary"):
        call_llm(load_unit_stage(), "combined prompt")
    assert structured.invoke.call_count == 1
