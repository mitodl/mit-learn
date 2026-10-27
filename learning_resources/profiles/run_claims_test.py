"""Tests for generating a run's context claims"""

import re
from collections import Counter

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
from learning_resources.profiles.run_claims import (
    generate_context_claims,
    load_context_stage,
)
from learning_resources.profiles.schemas import CourseContextOut
from learning_resources.profiles.unit_claims import (
    ClaimExtractionError,
    call_llm,
    title_context,
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
            "instructional_outline": [{"unit_label": "Week 1", "title": "Kinematics"}],
            "conflicts": [],
            "notes": [],
        }
    )


class FakeLLM:
    """Stands in for call_llm, answering the context stage"""

    def __init__(self, *, fail=False):
        self.calls = []
        self.fail = fail

    def __call__(self, stage, prompt):
        self.calls.append((stage.name, prompt))
        if self.fail:
            msg = "bad response"
            raise ClaimExtractionError(msg)
        return _context_out(prompt), "context raw"


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
    """Return a run with a context unit and one other unit"""
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
    unit = UnitFactory.create(run=run, external_id="seq0", title="Week 0", position=0)
    _add_file(
        unit, "Lecture 0: the net force on a body equals its mass times acceleration."
    )
    return run


def test_generate_context_claims(fake_llm):
    """The context unit gets one call, and its verified output is stored"""
    run = _build_run()
    stats = Counter()

    context = generate_context_claims(run, stats=stats)

    assert stats == {"generated": 1}
    assert [name for name, _ in fake_llm.calls] == ["context"]
    prompt = fake_llm.calls[0][1]
    assert f"Course: {run.learning_resource.title}" in prompt
    assert "first-year students" in prompt
    assert "net force" not in prompt

    extraction = ClaimExtraction.objects.get(unit__kind=Unit.Kind.CONTEXT)
    assert extraction.model == "test-model"
    assert extraction.extractor_version.startswith("context-")
    assert extraction.raw_response == "context raw"
    output = extraction.output
    assert output["description"]["evidence"][0]["verified"] == "exact"
    assert [source["source_id"] for source in output["sources"]] == ["S01"]
    assert context.key == extraction.key
    assert "Title: Classical Mechanics" in context.digest
    assert "Prerequisites (stated): [prerequisite] 18.01 is required" in context.digest
    assert "Outline: Week 1 Kinematics" in context.digest


def test_generate_context_claims_cached(fake_llm):
    """A second call makes no model call and returns the same context"""
    run = _build_run()
    first = generate_context_claims(run)
    stats = Counter()

    assert generate_context_claims(run, stats=stats) == first
    assert stats == {"cached": 1}
    assert len(fake_llm.calls) == 1


def test_context_reused_by_other_run(fake_llm):
    """Another run of the course with the same files reuses the extraction"""
    run = _build_run()
    first = generate_context_claims(run)
    other_run = _build_run(
        LearningResourceRunFactory.create(learning_resource=run.learning_resource)
    )

    assert generate_context_claims(other_run) == first
    assert len(fake_llm.calls) == 1


def test_context_of_other_course_with_same_files(fake_llm):
    """Another course with the same files gets its own context, with its title"""
    first = generate_context_claims(_build_run())
    other_run = _build_run()

    assert generate_context_claims(other_run).key != first.key
    assert other_run.learning_resource.title in fake_llm.calls[1][1]


def test_changed_context_file_changes_key(fake_llm):
    """A changed context file reruns the context and changes its key"""
    run = _build_run()
    first = generate_context_claims(run)
    _add_file(run.units.get(kind=Unit.Kind.CONTEXT), "Grading: 50% exams.", position=1)

    assert generate_context_claims(run).key != first.key
    assert len(fake_llm.calls) == 2


def test_context_overwrite(fake_llm):
    """Overwrite calls the model again and replaces the extraction"""
    run = _build_run()
    generate_context_claims(run)
    stats = Counter()

    generate_context_claims(run, overwrite=True, stats=stats)

    assert stats == {"generated": 1}
    assert len(fake_llm.calls) == 2
    assert ClaimExtraction.objects.count() == 1


def test_no_context_unit(fake_llm):
    """A run with no context unit gets the course title alone"""
    run = LearningResourceRunFactory.create()

    assert generate_context_claims(run) == title_context(run)
    assert fake_llm.calls == []


def test_context_over_budget(fake_llm):
    """A context unit over the input budget makes no call"""
    ResourceProfileConfiguration.objects.filter(stage="context").update(
        input_token_budget=10
    )
    run = _build_run()
    stats = Counter()

    assert generate_context_claims(run, stats=stats) == title_context(run)
    assert stats == {"over_budget": 1}
    assert fake_llm.calls == []


def test_failed_context(mocker):
    """A context unit with no valid response raises, and nothing is stored"""
    mocker.patch.object(unit_claims, "call_llm", FakeLLM(fail=True))

    with pytest.raises(ClaimExtractionError):
        generate_context_claims(_build_run())
    assert not ClaimExtraction.objects.exists()


def test_missing_configuration():
    """Generation needs every stage configured"""
    ResourceProfileConfiguration.objects.filter(stage="context").delete()
    with pytest.raises(ClaimExtractionError, match="context"):
        load_context_stage()


def test_call_llm_notes_dropped_context_claims(mocker):
    """Claims dropped from a context output are listed in its notes"""
    args = _context_out("=== SOURCE S01 | x ===\nsome source text here").model_dump()
    args["prerequisites"][0]["kind"] = "principle"
    structured = mocker.Mock()
    structured.invoke.return_value = {
        "raw": AIMessage(
            content="",
            tool_calls=[{"name": "CourseContextOut", "args": args, "id": "call1"}],
        ),
        "parsed": None,
        "parsing_error": ValueError("bad"),
    }
    chat = mocker.patch.object(unit_claims, "ChatLiteLLM")
    chat.return_value.with_structured_output.return_value = structured

    parsed, _ = call_llm(load_context_stage(), "combined prompt")

    assert parsed.prerequisites == []
    assert len(parsed.notes) == 1
    assert parsed.notes[0].startswith(
        "Dropped prerequisites item 1 ('Calculus'), which did not validate: kind:"
    )
