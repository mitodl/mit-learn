"""Tests for generating a unit's resource profile claims"""

import re
from datetime import timedelta

import pytest
from langchain_core.messages import AIMessage

from learning_resources.factories import (
    ClaimExtractionFactory,
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
from learning_resources.profiles import claims
from learning_resources.profiles.claims import (
    ClaimExtractionError,
    call_llm,
)
from learning_resources.profiles.schemas import UnitExtraction, UnitMergeExtraction
from learning_resources.profiles.unit_claims import (
    generate_unit_claims,
    load_unit_extractor,
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


def _assumed(source_id, text, label, *, flagged_as_prior=False):
    return {
        "label": label,
        "description": f"{label}, assumed",
        "how_used": "Used without explanation",
        "flagged_as_prior": flagged_as_prior,
        "evidence": [{"source_id": source_id, "passage": text, "locator": None}],
    }


def _part_out(prompt):
    """Return a part's extraction: a unit's, with assumed knowledge"""
    output = _unit_out(prompt).model_dump()
    source_id, text = _SOURCE.findall(prompt)[0]
    output["assumed_knowledge"] = [
        _assumed(source_id, text, "Newton's second law"),
        _assumed(source_id, text, "Algebra", flagged_as_prior="PART 2 " in prompt),
    ]
    return UnitExtraction.model_validate(output)


def _merged(label, part_claim_ids, **fields):
    return {
        "label": label,
        "description": f"{label}, merged",
        "part_claim_ids": part_claim_ids,
        **fields,
    }


def _merge_out(_prompt):
    """Return a merge of a two-part unit's parts, with claims code should drop"""
    concept = {"kind": "concept", "teaching_status": "used"}
    assumed = {"how_used": "Used without explanation", "flagged_as_prior": False}
    return UnitMergeExtraction.model_validate(
        {
            "summary": "The whole unit teaches forces.",
            "concepts": [
                _merged("Newton's second law", ["P1:c1", "P2:c1", "P2:c1"], **concept),
                _merged("Invented", ["P9:c1"], **concept),
                _merged("Mislabeled", ["P1:s1"], **concept),
            ],
            "skills": [_merged("Draw a free-body diagram", ["P1:s1", "P2:s1"])],
            "assumed_knowledge": [
                _merged("Newton's Second Law", ["P1:a1", "P2:a1"], **assumed),
                _merged("Algebra", ["P1:a2", "P2:a2"], **assumed),
            ],
            "assessment_expectations": [],
            "extraction_notes": ["Merged notes"],
        }
    )


def _answer(extractor, prompt):
    if extractor.schema is UnitMergeExtraction:
        return _merge_out(prompt), "merge raw"
    if "PART " in prompt:
        return _part_out(prompt), "part raw"
    return _unit_out(prompt), "unit raw"


@pytest.fixture
def fake_llm(mocker):
    """Replace the model with one that answers from the prompt"""
    return mocker.patch.object(claims, "call_llm", side_effect=_answer)


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
    ResourceProfileConfiguration.objects.update_or_create(
        stage=ResourceProfileConfiguration.Stage.UNIT_MERGE,
        defaults={
            "llm_model": "test-model",
            "prompt": "merge prompt",
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
    return generate_unit_claims(unit, **kwargs)


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


def test_outline_in_prompt_not_key(fake_llm):
    """The run's units, in order, are in the prompt but not its key"""
    unit = _build_unit(position=1)
    UnitFactory.create(run=unit.run, external_id="seq1", title="Week 1", position=0)
    UnitFactory.create(
        run=unit.run, kind=Unit.Kind.BIN, external_id="bin:pdf", position=None
    )
    first = _generate(unit)

    prompt = _prompt(fake_llm)
    assert "Units (course order): 1. Week 1; 2. Week 0" in prompt
    assert "title='Week 0' | kind=unit | unit 2\n" in prompt
    assert _generate(unit).key == first.key
    other = Unit.objects.get(external_id="seq1")
    other.title = "Renamed week"
    other.position = 5
    other.save()
    UnitFactory.create(run=unit.run, external_id="seq2", title="Week 2", position=2)
    assert _generate(unit).key == first.key
    assert fake_llm.call_count == 1


def test_unit_title_in_key(fake_llm):
    """Renaming a unit changes its own key"""
    unit = _build_unit()
    first = _generate(unit)
    unit.title = "Week 0: forces"
    unit.save()

    assert _generate(unit).key != first.key
    assert fake_llm.call_count == 2


def test_context_extraction_not_needed(fake_llm):
    """A unit is extracted without its run's context unit being extracted"""
    UnitFactory.create(
        run=_build_unit().run, kind=Unit.Kind.CONTEXT, external_id="context"
    )
    ResourceProfileConfiguration.objects.filter(stage="context").delete()

    assert _generate(Unit.objects.get(external_id="seq0")) is not None
    assert fake_llm.call_count == 1


def test_context_unit_rejected(fake_llm):
    """The context unit isn't extracted with the unit prompt"""
    unit = _build_unit(kind=Unit.Kind.CONTEXT, position=None)

    with pytest.raises(ValueError, match="generate_context_claims"):
        _generate(unit)
    assert fake_llm.call_count == 0


def test_course_in_key(fake_llm):
    """Units are keyed by their course"""
    unit = _build_unit()
    other = _build_unit()

    first = _generate(unit)
    assert _generate(other) != first
    assert fake_llm.call_count == 2


def test_replaced_extraction_unpublished(fake_llm):
    """A unit's extraction is unpublished when it is replaced"""
    unit = _build_unit()
    first = _generate(unit)
    ClaimExtraction.objects.filter(pk=first.pk).update(published=True)

    assert _generate(unit).published is True
    _add_file(unit, "An added worked example.", position=2)
    assert _generate(unit).published is False


def test_unit_left_with_one_extraction(fake_llm):
    """Storing a unit's extraction replaces every row the unit had"""
    unit = _build_unit()
    ClaimExtractionFactory.create_batch(2, unit=unit)

    extraction = _generate(unit)

    assert list(ClaimExtraction.objects.filter(unit=unit)) == [extraction]
    assert fake_llm.call_count == 1


def test_same_title_in_other_course_keyed_apart(fake_llm):
    """Another course with the same title and files gets its own extraction"""
    unit = _build_unit()
    other_course = LearningResourceRunFactory.create(
        learning_resource__title=unit.run.learning_resource.title
    )
    other = _build_unit(other_course)

    first = _generate(unit)
    second = _generate(other)

    assert second.pk != first.pk
    assert second.key != first.key
    first.refresh_from_db()
    assert (first.unit, second.unit) == (unit, other)
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
    """Another run's unit with the same files takes over the extraction"""
    unit = _build_unit()
    extraction = _generate(unit)
    other_run = LearningResourceRunFactory.create(
        learning_resource=unit.run.learning_resource
    )
    other_unit = _build_unit(other_run)

    reused = _generate(other_unit)

    assert reused.pk == extraction.pk
    assert reused.unit == other_unit
    assert ClaimExtraction.objects.count() == 1
    assert fake_llm.call_count == 1


def test_changed_file_reruns_unit(fake_llm):
    """A changed file makes a new call that replaces the unit's extraction"""
    unit = _build_unit()
    first = _generate(unit)
    _add_file(unit, "An added worked example.", position=2)

    extraction = _generate(unit)

    assert extraction.pk == first.pk
    assert extraction.key != first.key
    assert ClaimExtraction.objects.count() == 1
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


# each of _build_unit's files fits the budget, but not both
SPLIT_BUDGET = 60


def _split_budget(budget=SPLIT_BUDGET):
    ResourceProfileConfiguration.objects.filter(
        stage=ResourceProfileConfiguration.Stage.UNIT
    ).update(input_token_budget=budget)


def _parts(unit):
    return list(
        ClaimExtraction.objects.filter(
            unit=unit, level=ClaimExtraction.Level.UNIT_PART
        ).order_by("part")
    )


def test_unit_over_budget_split(fake_llm):
    """A unit over the input budget is extracted in parts, which are merged"""
    _split_budget()
    unit = _build_unit()

    extraction = _generate(unit)

    assert fake_llm.call_count == 3
    first, second, merge = (_prompt(fake_llm, call) for call in range(3))
    assert "PART 1 of the unit: sources S01-S01" in first
    assert "=== SOURCE S02" not in first
    assert "PART 2 of the unit: sources S02-S02" in second
    assert "=== SOURCE S01" not in second
    assert "## Part 1 of 2 (sources S01-S01)" in merge
    assert "- [P2:c1] [taught] (concept) Newton's second law:" in merge
    assert "- [P2:a2] Algebra: Algebra, assumed" in merge
    assert "=== SOURCE" not in merge

    parts = _parts(unit)
    assert [part.part for part in parts] == [1, 2]
    assert {part.raw_response for part in parts} == {"part raw"}
    assert extraction.level == ClaimExtraction.Level.UNIT
    assert extraction.part is None
    assert extraction.unit == unit
    assert extraction.raw_response == "merge raw"
    assert extraction.extractor_version.startswith("unit_merge-")
    output = extraction.output
    assert output["summary"] == "The whole unit teaches forces."
    assert [source["source_id"] for source in output["sources"]] == ["S01", "S02"]


def test_split_unit_claims_resolved(fake_llm):
    """Merged claims carry their part claims' evidence, checked in code"""
    _split_budget()

    output = _generate(_build_unit()).output

    [concept] = output["concepts"]
    assert concept["id"] == "c1"
    # the strongest status of the cited claims, not the model's
    assert concept["teaching_status"] == "taught"
    assert concept["part_claim_ids"] == ["P1:c1", "P2:c1"]
    assert [item["source_id"] for item in concept["evidence"]] == ["S01", "S02"]
    assert {item["verified"] for item in concept["evidence"]} == {"exact"}
    [skill] = output["skills"]
    assert skill["id"] == "s1"
    assert len(skill["evidence"]) == 2
    # the assumed item the unit teaches is dropped, and flagged_as_prior is
    # kept from the part that set it
    [assumed] = output["assumed_knowledge"]
    assert assumed["label"] == "Algebra"
    assert assumed["id"] == "a1"
    assert assumed["flagged_as_prior"] is True
    notes = output["extraction_notes"]
    assert notes[0] == "Merged notes"
    assert any("'Invented'" in note for note in notes)
    assert any("'Mislabeled'" in note for note in notes)
    assert any(
        note.startswith('Dropped assumed knowledge "Newton\'s Second Law"')
        for note in notes
    )


def test_merge_cannot_strengthen_part_claims(fake_llm):
    """The merge's own status and prior flag are replaced by the cited claims'"""

    def answer(extractor, prompt):
        parsed, raw = _answer(extractor, prompt)
        output = parsed.model_dump()
        if extractor.schema is UnitMergeExtraction:
            output["concepts"][0]["teaching_status"] = "taught"
            output["assumed_knowledge"][0]["flagged_as_prior"] = True
        else:
            for concept in output["concepts"]:
                concept["teaching_status"] = "mentioned"
        return extractor.schema.model_validate(output), raw

    fake_llm.side_effect = answer
    _split_budget()

    output = _generate(_build_unit()).output

    [concept] = output["concepts"]
    assert concept["teaching_status"] == "mentioned"
    # no part teaches it, so the assumed item is kept, unflagged like its parts
    assumed = {item["label"]: item for item in output["assumed_knowledge"]}
    assert assumed["Newton's Second Law"]["flagged_as_prior"] is False
    assert assumed["Algebra"]["flagged_as_prior"] is True


def test_split_unit_cached(fake_llm):
    """A split unit whose files haven't changed makes no call"""
    _split_budget()
    unit = _build_unit()
    extraction = _generate(unit)

    assert _generate(unit) == extraction
    assert fake_llm.call_count == 3


def test_split_unit_changed_part_reruns(fake_llm):
    """A changed file reruns its part and the merge, not the other parts"""
    _split_budget()
    unit = _build_unit()
    first = _generate(unit)
    first_parts = _parts(unit)
    content_file = unit.content_files.get(title__startswith="Problem set")
    content_file.content = "Problem set: find the tension in each rope."
    content_file.save()

    extraction = _generate(unit)

    assert fake_llm.call_count == 5
    assert "PART 2 of the unit" in _prompt(fake_llm, 3)
    parts = _parts(unit)
    assert parts[0].key == first_parts[0].key
    assert parts[1].key != first_parts[1].key
    assert extraction.pk == first.pk
    assert extraction.key != first.key


def test_split_unit_fewer_parts(fake_llm):
    """Parts left from a longer split are deleted"""
    _split_budget()
    unit = _build_unit()
    _add_file(unit, "Recitation: two blocks joined by a string.", position=2)
    _generate(unit)
    assert len(_parts(unit)) == 3

    unit.unitcontentfile_set.get(position=2).delete()
    _generate(unit)

    assert [part.part for part in _parts(unit)] == [1, 2]


def test_unit_no_longer_split(fake_llm):
    """A unit that fits in one call again keeps only its unit extraction"""
    _split_budget()
    unit = _build_unit()
    _generate(unit)
    _split_budget(100000)

    extraction = _generate(unit)

    assert list(ClaimExtraction.objects.filter(unit=unit)) == [extraction]
    assert extraction.raw_response == "unit raw"


def test_split_unit_overwrite(fake_llm):
    """Overwrite reruns every part and the merge"""
    _split_budget()
    unit = _build_unit()
    first = _generate(unit)

    extraction = _generate(unit, overwrite=True)

    assert fake_llm.call_count == 6
    assert extraction.pk == first.pk
    assert len(_parts(unit)) == 2


def test_unit_without_text_skipped(fake_llm):
    """A unit with no file text makes no call"""
    unit = UnitFactory.create()
    _add_file(unit, "   ")

    assert _generate(unit) is None
    fake_llm.assert_not_called()


def test_failed_call_stores_nothing(mocker):
    """A call that fails raises and stores nothing"""
    mocker.patch.object(
        claims, "call_llm", side_effect=ClaimExtractionError("bad response")
    )

    with pytest.raises(ClaimExtractionError):
        _generate(_build_unit())
    assert not ClaimExtraction.objects.exists()


def test_missing_configuration():
    """Generation needs the unit stage configured"""
    ResourceProfileConfiguration.objects.all().delete()
    with pytest.raises(ClaimExtractionError, match="unit"):
        load_unit_extractor()


def test_call_llm(mocker, settings):
    """call_llm returns the parsed output and the raw tool call arguments"""
    extractor = load_unit_extractor()
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
    chat = mocker.patch.object(claims, "ChatLiteLLM")
    chat.return_value.with_structured_output.return_value = structured

    assert call_llm(extractor, "combined prompt") == (output, '{"summary": 1}')
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
    chat = mocker.patch.object(claims, "ChatLiteLLM")
    chat.return_value.with_structured_output.return_value = structured

    call_llm(load_unit_extractor(), "combined prompt")

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
    chat = mocker.patch.object(claims, "ChatLiteLLM")
    chat.return_value.with_structured_output.return_value = structured

    with pytest.raises(ClaimExtractionError, match="no valid UnitExtraction"):
        call_llm(load_unit_extractor(), "combined prompt")
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
    chat = mocker.patch.object(claims, "ChatLiteLLM")
    chat.return_value.with_structured_output.return_value = structured

    parsed, _ = call_llm(load_unit_extractor(), "combined prompt")

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
    chat = mocker.patch.object(claims, "ChatLiteLLM")
    chat.return_value.with_structured_output.return_value = structured

    with pytest.raises(ClaimExtractionError, match="summary"):
        call_llm(load_unit_extractor(), "combined prompt")
    assert structured.invoke.call_count == 1
