"""Tests for step 1 of course profile generation"""

import re

import pytest
from langchain_core.messages import AIMessage

from learning_resources.course_profile import unit_claims
from learning_resources.course_profile.schemas import (
    CourseContextOut,
    UnitExtraction,
    UnitMergeOut,
)
from learning_resources.course_profile.unit_claims import (
    ClaimExtractionError,
    call_llm,
    generate_unit_claims,
    load_stages,
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


def _evidence(prompt):
    """Quote the first line of each source in a prompt"""
    return [
        {"source_id": source_id, "passage": text, "locator": None}
        for source_id, text in _SOURCE.findall(prompt)
    ]


def _context_out(prompt):
    evidence = _evidence(prompt)[:1]
    return CourseContextOut.model_validate(
        {
            "title": "Classical Mechanics",
            "stated_audience": [{"text": "First-year students", "evidence": evidence}],
            "description": {"text": "An intro to mechanics", "evidence": evidence},
            "objectives": [],
            "prerequisites_status": "stated",
            "prerequisites": [
                {
                    "label": "Calculus",
                    "statement": "18.01 is required",
                    "kind": "prerequisite",
                    "evidence": evidence,
                }
            ],
            "required_materials": [],
            "instructional_outline": [
                {"unit_label": "Week 1", "title": "Kinematics", "lesson_titles": []}
            ],
            "conflicts": [],
            "notes": [],
        }
    )


def _unit_out(prompt, status="taught"):
    evidence = _evidence(prompt)
    return UnitExtraction.model_validate(
        {
            "summary": "The unit teaches forces.",
            "concepts": [
                {
                    "label": "Newton's second law",
                    "description": "Force equals mass times acceleration",
                    "kind": "concept",
                    "teaching_status": status,
                    "evidence": evidence[:1],
                }
            ],
            "skills": [
                {
                    "label": "Draw a free-body diagram",
                    "description": "Draw the forces on a body",
                    "evidence": [
                        {
                            "source_id": evidence[0]["source_id"],
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


def _merge_out():
    return UnitMergeOut.model_validate(
        {
            "summary": "The whole unit teaches forces.",
            "concepts": [
                {
                    "label": "Newton's second law",
                    "description": "Force equals mass times acceleration",
                    "kind": "concept",
                    "teaching_status": "used",
                    "part_claim_ids": ["P1:c1", "P2:c1"],
                },
                {
                    "label": "Invented",
                    "description": "Cites nothing real",
                    "kind": "concept",
                    "teaching_status": "taught",
                    "part_claim_ids": ["P7:c1"],
                },
            ],
            "skills": [],
            "assumed_knowledge": [],
            "assessment_expectations": [],
            "extraction_notes": [],
        }
    )


class FakeLLM:
    """Stands in for call_llm, answering each stage from its prompt"""

    def __init__(self, fail=lambda stage, prompt: False):  # noqa: ARG005
        self.calls = []
        self.fail = fail

    def __call__(self, stage, prompt):
        self.calls.append((stage.name, prompt))
        if self.fail(stage, prompt):
            msg = "bad response"
            raise ClaimExtractionError(msg)
        if stage.name == "context":
            return _context_out(prompt), "context raw"
        if stage.name == "unit_merge":
            return _merge_out(), "merge raw"
        # part 1 of a split unit uses the concept that part 2 teaches
        status = "used" if "This is part 1 of the unit" in prompt else "taught"
        return _unit_out(prompt, status), f"{stage.name} raw"

    def names(self):
        return [name for name, _ in self.calls]


@pytest.fixture
def fake_llm(mocker):
    """Replace the model with FakeLLM"""
    fake = FakeLLM()
    mocker.patch.object(unit_claims, "call_llm", fake)
    return fake


@pytest.fixture(autouse=True)
def configurations():
    """Configure every stage"""
    for stage in CourseProfileConfiguration.Stage.values:
        CourseProfileConfiguration.objects.update_or_create(
            stage=stage,
            defaults={
                "llm_model": "test-model",
                "prompt": f"{stage} prompt",
                "max_file_tokens": 25000,
                "input_token_budget": 100000,
            },
        )


def _add_file(unit, text, position=0, title=None):
    content_file = ContentFileFactory.create(
        run=unit.run,
        content=text,
        title=title or text[:20],
        content_type="file",
        file_type="application/pdf",
    )
    UnitContentFileFactory.create(
        unit=unit, content_file=content_file, position=position
    )
    return content_file


def _build_run(run=None):
    """Return a run with a context unit, two units and a bin"""
    run = run or LearningResourceRunFactory.create()
    context = UnitFactory.create(
        run=run,
        kind=Unit.Kind.CONTEXT,
        external_id="context",
        title="Context",
        position=None,
    )
    _add_file(
        context, "This course requires 18.01 and is meant for first-year students."
    )
    units = [
        UnitFactory.create(
            run=run, external_id=f"seq{index}", title=f"Week {index}", position=index
        )
        for index in range(2)
    ]
    for index, unit in enumerate(units):
        _add_file(
            unit,
            f"Lecture {index}: the net force on a body equals its mass times acceleration.",
        )
        _add_file(
            unit,
            f"Problem set {index}: find the acceleration of each block.",
            position=1,
        )
    bin_unit = UnitFactory.create(
        run=run,
        kind=Unit.Kind.BIN,
        external_id="bin:readings",
        title="Readings",
        position=None,
    )
    _add_file(bin_unit, "Reading: a short chapter on vectors and their components.")
    return run


def test_generate_unit_claims(fake_llm):
    """Each unit gets one call, after the context unit, and its output is stored"""
    run = _build_run()

    stats = generate_unit_claims(run)

    assert stats == {"generated": 4, "extracted": 3}
    assert fake_llm.names() == ["context", "unit", "unit", "unit"]
    # every unit prompt has the context digest; the bin prompt says it is a bin
    for _, prompt in fake_llm.calls[1:]:
        assert "Prerequisites (stated): [prerequisite] 18.01 is required" in prompt
    assert "not part of a course unit" in fake_llm.calls[3][1]

    week = run.units.get(external_id="seq0")
    extraction = ClaimExtraction.objects.get(unit=week)
    assert extraction.level == ClaimExtraction.Level.UNIT
    assert extraction.model == "test-model"
    assert extraction.extractor_version.startswith("unit-")
    assert extraction.raw_response == "unit raw"
    assert extraction.part is None
    output = extraction.output
    assert [source["source_id"] for source in output["sources"]] == ["S01", "S02"]
    concept = output["concepts"][0]
    assert concept["id"] == "c1"
    assert concept["evidence"][0]["source_id"] == "S01"
    assert concept["evidence"][0]["verified"] == "exact"
    assert output["skills"][0]["id"] == "s1"
    assert output["skills"][0]["evidence"][0]["verified"] == "unverified"

    context = ClaimExtraction.objects.get(unit__kind=Unit.Kind.CONTEXT)
    assert context.output["description"]["evidence"][0]["verified"] == "exact"


def test_generate_unit_claims_cached(fake_llm):
    """A second run makes no calls"""
    run = _build_run()
    generate_unit_claims(run)
    calls = len(fake_llm.calls)

    assert generate_unit_claims(run) == {"cached": 4, "extracted": 3}
    assert len(fake_llm.calls) == calls
    assert ClaimExtraction.objects.count() == 4


def test_identical_run_reuses_extractions(fake_llm):
    """Another run of the course with the same files reuses every result"""
    run = _build_run()
    generate_unit_claims(run)
    other_run = _build_run(
        LearningResourceRunFactory.create(learning_resource=run.learning_resource)
    )

    assert generate_unit_claims(other_run) == {"cached": 4, "extracted": 3}


def test_changed_file_reruns_its_unit(fake_llm):
    """A changed file reruns only the unit it is in"""
    run = _build_run()
    generate_unit_claims(run)
    _add_file(run.units.get(external_id="seq1"), "An added worked example.", position=2)

    assert generate_unit_claims(run) == {"cached": 3, "generated": 1, "extracted": 3}


def test_prompt_change_reruns_stage(fake_llm):
    """Editing the unit prompt reruns the units but not the context"""
    run = _build_run()
    generate_unit_claims(run)
    CourseProfileConfiguration.objects.filter(stage="unit").update(prompt="new prompt")

    assert generate_unit_claims(run) == {"cached": 1, "generated": 3, "extracted": 3}


def test_context_change_reruns_units(fake_llm):
    """A changed context file reruns every unit"""
    run = _build_run()
    generate_unit_claims(run)
    _add_file(run.units.get(kind=Unit.Kind.CONTEXT), "Grading: 50% exams.", position=1)

    assert generate_unit_claims(run) == {"generated": 4, "extracted": 3}


def test_split_unit(fake_llm):
    """A unit over the budget is read in parts, and the parts are merged"""
    CourseProfileConfiguration.objects.filter(stage="unit").update(
        input_token_budget=30
    )
    run = LearningResourceRunFactory.create()
    unit = UnitFactory.create(run=run, external_id="seq0", title="Week 0")
    _add_file(unit, "Part one text: momentum is mass times velocity for any body.")
    _add_file(
        unit, "Part two text: impulse equals the change in momentum of a body.", 1
    )

    assert generate_unit_claims(run) == {"generated": 3, "extracted": 1}
    assert fake_llm.names() == ["unit_part", "unit_part", "unit_merge"]
    assert "No course context is available." in fake_llm.calls[0][1]
    assert "[P1:c1] [used] Newton's second law" in fake_llm.calls[2][1]
    assert "[P2:c1] [taught] Newton's second law" in fake_llm.calls[2][1]

    parts = ClaimExtraction.objects.filter(level=ClaimExtraction.Level.UNIT_PART)
    assert sorted(parts.values_list("part", flat=True)) == [0, 1]
    merged = ClaimExtraction.objects.get(unit=unit, level=ClaimExtraction.Level.UNIT)
    assert merged.extractor_version.startswith("unit_merge-")
    output = merged.output
    assert output["part_keys"] == [
        parts.get(part=0).key,
        parts.get(part=1).key,
    ]
    # the invented claim cites no part claim and is dropped
    assert len(output["concepts"]) == 1
    concept = output["concepts"][0]
    assert concept["id"] == "c1"
    # the merge said "used", but part 2 taught it
    assert concept["teaching_status"] == "taught"
    assert concept["part_claim_ids"] == ["P1:c1", "P2:c1"]
    assert [item["source_id"] for item in concept["evidence"]] == ["S01", "S02"]
    assert {item["verified"] for item in concept["evidence"]} == {"exact"}
    assert (
        "1 merged claim(s) cited no part claim and were dropped"
        in (output["extraction_notes"])
    )
    assert [source["source_id"] for source in output["sources"]] == ["S01", "S02"]

    assert generate_unit_claims(run) == {"cached": 3, "extracted": 1}


def test_truncated_files_noted(fake_llm):
    """Files over the per-file limit are truncated and listed in the notes"""
    CourseProfileConfiguration.objects.filter(stage="unit").update(max_file_tokens=10)
    run = LearningResourceRunFactory.create()
    unit = UnitFactory.create(run=run)
    _add_file(unit, "A long transcript. " * 20)

    generate_unit_claims(run)

    output = ClaimExtraction.objects.get(unit=unit).output
    assert output["sources"][0]["truncated"] is True
    assert output["extraction_notes"] == [
        "S01 was truncated: 40 of 379 characters were read"
    ]


def test_failed_unit_is_skipped(mocker):
    """A unit that fails doesn't stop the others"""
    fake = FakeLLM(fail=lambda stage, prompt: "title='Week 0'" in prompt)  # noqa: ARG005
    mocker.patch.object(unit_claims, "call_llm", fake)
    run = _build_run()

    assert generate_unit_claims(run) == {"generated": 3, "failed": 1, "extracted": 2}
    assert not ClaimExtraction.objects.filter(unit__external_id="seq0").exists()


def test_failed_context_stops_run(mocker):
    """A context unit that fails stops the run"""
    fake = FakeLLM(fail=lambda stage, prompt: stage.name == "context")  # noqa: ARG005
    mocker.patch.object(unit_claims, "call_llm", fake)
    run = _build_run()

    with pytest.raises(ClaimExtractionError):
        generate_unit_claims(run)
    assert fake.names() == ["context"]


def test_unit_without_text_skipped(fake_llm):
    """A unit with no file text makes no call"""
    run = LearningResourceRunFactory.create()
    unit = UnitFactory.create(run=run)
    _add_file(unit, "   ")

    assert generate_unit_claims(run) == {"skipped": 1}
    assert fake_llm.calls == []


def test_missing_configuration():
    """Generation needs every stage configured"""
    CourseProfileConfiguration.objects.filter(stage="unit_merge").delete()
    with pytest.raises(ClaimExtractionError, match="unit_merge"):
        load_stages()


def test_call_llm_retries_invalid_response(mocker, settings):
    """A response that doesn't validate is requested again"""
    settings.COURSE_PROFILE_LLM_ATTEMPTS = 2
    stage = load_stages().unit
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

    assert call_llm(stage, "prompt prompt") == (output, '{"summary": 1}')
    chat.assert_called_once_with(
        model="test-model",
        temperature=0.0,
        max_tokens=stage.config.max_output_tokens,
        api_base=settings.LITELLM_API_BASE,
        request_timeout=settings.COURSE_PROFILE_LLM_TIMEOUT,
    )
    chat.return_value.with_structured_output.assert_called_once_with(
        UnitExtraction, include_raw=True
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
        call_llm(load_stages().unit, "prompt prompt")
