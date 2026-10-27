"""Tests for generating a run's resource profile claims"""

import re

import pytest

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
from learning_resources.profiles.run_claims import (
    generate_run_claims,
    load_context_stage,
)
from learning_resources.profiles.schemas import CourseContextOut, UnitExtraction
from learning_resources.profiles.unit_claims import ClaimExtractionError

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


def _unit_out(prompt):
    evidence = _evidence(prompt)
    return UnitExtraction.model_validate(
        {
            "summary": "The unit teaches forces.",
            "concepts": [
                {
                    "label": "Newton's second law",
                    "description": "Force equals mass times acceleration",
                    "kind": "concept",
                    "teaching_status": "taught",
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
        return _unit_out(prompt), f"{stage.name} raw"

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
    for stage in ResourceProfileConfiguration.Stage.values:
        ResourceProfileConfiguration.objects.update_or_create(
            stage=stage,
            defaults={
                "llm_model": "test-model",
                "prompt": f"{stage} prompt",
                "max_file_tokens": 25000,
                "input_token_budget": 100000,
                "reasoning_effort": None,
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


def test_generate_run_claims(fake_llm):
    """Each unit gets one call, after the context unit, and its output is stored"""
    run = _build_run()

    stats = generate_run_claims(run)

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


def test_generate_run_claims_cached(fake_llm):
    """A second run makes no calls"""
    run = _build_run()
    generate_run_claims(run)
    calls = len(fake_llm.calls)

    assert generate_run_claims(run) == {"cached": 4, "extracted": 3}
    assert len(fake_llm.calls) == calls
    assert ClaimExtraction.objects.count() == 4


def test_identical_run_reuses_extractions(fake_llm):
    """Another run of the course with the same files reuses every result"""
    run = _build_run()
    generate_run_claims(run)
    other_run = _build_run(
        LearningResourceRunFactory.create(learning_resource=run.learning_resource)
    )

    assert generate_run_claims(other_run) == {"cached": 4, "extracted": 3}


def test_changed_file_reruns_its_unit(fake_llm):
    """A changed file reruns only the unit it is in"""
    run = _build_run()
    generate_run_claims(run)
    _add_file(run.units.get(external_id="seq1"), "An added worked example.", position=2)

    assert generate_run_claims(run) == {"cached": 3, "generated": 1, "extracted": 3}


def test_prompt_change_keeps_claims(fake_llm):
    """Editing a prompt reuses the stored claims"""
    run = _build_run()
    generate_run_claims(run)
    ResourceProfileConfiguration.objects.update(prompt="new prompt")

    assert generate_run_claims(run) == {"cached": 4, "extracted": 3}


def test_overwrite_reruns_run(fake_llm):
    """Overwrite reruns the context and every unit, replacing their extractions"""
    run = _build_run()
    generate_run_claims(run)

    assert generate_run_claims(run, overwrite=True) == {"generated": 4, "extracted": 3}
    assert len(fake_llm.calls) == 8
    assert ClaimExtraction.objects.count() == 4


def test_context_change_reruns_units(fake_llm):
    """A changed context file reruns every unit"""
    run = _build_run()
    generate_run_claims(run)
    _add_file(run.units.get(kind=Unit.Kind.CONTEXT), "Grading: 50% exams.", position=1)

    assert generate_run_claims(run) == {"generated": 4, "extracted": 3}


def test_unit_over_budget_skipped(fake_llm):
    """A unit whose files are over the input budget makes no call"""
    ResourceProfileConfiguration.objects.filter(stage="unit").update(
        input_token_budget=30
    )
    run = _build_run()

    assert generate_run_claims(run) == {"generated": 1, "over_budget": 3}
    assert fake_llm.names() == ["context"]


def test_context_over_budget_skipped(fake_llm):
    """A context unit over the input budget is skipped and units go on without it"""
    ResourceProfileConfiguration.objects.filter(stage="context").update(
        input_token_budget=10
    )
    run = _build_run()

    assert generate_run_claims(run) == {
        "generated": 3,
        "extracted": 3,
        "over_budget": 1,
    }
    assert fake_llm.names() == ["unit", "unit", "unit"]
    assert "No course context is available." in fake_llm.calls[0][1]


def test_failed_unit_is_skipped(mocker):
    """A unit that fails doesn't stop the others"""
    fake = FakeLLM(fail=lambda stage, prompt: "title='Week 0'" in prompt)  # noqa: ARG005
    mocker.patch.object(unit_claims, "call_llm", fake)
    run = _build_run()

    assert generate_run_claims(run) == {"generated": 3, "failed": 1, "extracted": 2}
    assert not ClaimExtraction.objects.filter(unit__external_id="seq0").exists()


def test_failed_context_stops_run(mocker):
    """A context unit that fails stops the run"""
    fake = FakeLLM(fail=lambda stage, prompt: stage.name == "context")  # noqa: ARG005
    mocker.patch.object(unit_claims, "call_llm", fake)
    run = _build_run()

    with pytest.raises(ClaimExtractionError):
        generate_run_claims(run)
    assert fake.names() == ["context"]


def test_unit_without_text_skipped(fake_llm):
    """A unit with no file text makes no call"""
    run = LearningResourceRunFactory.create()
    unit = UnitFactory.create(run=run)
    _add_file(unit, "   ")

    assert generate_run_claims(run) == {"skipped": 1}
    assert fake_llm.calls == []


def test_missing_configuration():
    """Generation needs every stage configured"""
    ResourceProfileConfiguration.objects.filter(stage="context").delete()
    with pytest.raises(ClaimExtractionError, match="context"):
        load_context_stage()
