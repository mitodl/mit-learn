"""Tests for generating a run's context claims"""

import re

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
from learning_resources.profiles import claims
from learning_resources.profiles.claims import (
    ClaimExtractionError,
    call_llm,
)
from learning_resources.profiles.context_claims import (
    generate_context_claims,
    load_context_extractor,
    merge_context_outputs,
)
from learning_resources.profiles.schemas import CourseContextOut

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
            "extraction_notes": [],
        }
    )


class FakeLLM:
    """Stands in for call_llm, answering the context extractor"""

    def __init__(self, *, fail=False):
        self.calls = []
        self.fail = fail

    def __call__(self, extractor, prompt):
        self.calls.append((extractor.stage, prompt))
        if self.fail:
            msg = "bad response"
            raise ClaimExtractionError(msg)
        return _context_out(prompt), "context raw"


@pytest.fixture
def fake_llm(mocker):
    """Replace the model with FakeLLM"""
    fake = FakeLLM()
    mocker.patch.object(claims, "call_llm", fake)
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

    extraction = generate_context_claims(run)

    assert [name for name, _ in fake_llm.calls] == ["context"]
    prompt = fake_llm.calls[0][1]
    assert f"Course: {run.learning_resource.title}" in prompt
    assert "first-year students" in prompt
    assert "net force" not in prompt

    assert extraction == ClaimExtraction.objects.get(unit__kind=Unit.Kind.CONTEXT)
    assert extraction.model == "test-model"
    assert extraction.extractor_version.startswith("context-")
    assert extraction.raw_response == "context raw"
    output = extraction.output
    assert output["description"]["evidence"][0]["verified"] == "exact"
    assert [source["source_id"] for source in output["sources"]] == ["S01"]


def test_generate_context_claims_cached(fake_llm):
    """A second call makes no model call and returns the same extraction"""
    run = _build_run()
    first = generate_context_claims(run)

    assert generate_context_claims(run) == first
    assert len(fake_llm.calls) == 1


def test_context_reused_by_other_run(fake_llm):
    """Another run of the course with the same files takes over the extraction"""
    run = _build_run()
    first = generate_context_claims(run)
    other_run = _build_run(
        LearningResourceRunFactory.create(learning_resource=run.learning_resource)
    )

    reused = generate_context_claims(other_run)

    assert reused.pk == first.pk
    assert reused.unit == other_run.units.get(kind=Unit.Kind.CONTEXT)
    assert len(fake_llm.calls) == 1


def test_context_of_other_course_with_same_files(fake_llm):
    """Another course with the same files gets its own context, with its title"""
    generate_context_claims(_build_run())
    other_run = _build_run()
    generate_context_claims(other_run)

    assert ClaimExtraction.objects.count() == 2
    assert other_run.learning_resource.title in fake_llm.calls[1][1]


def test_context_of_other_course_with_same_title(fake_llm):
    """Another course with the same title and files gets its own context"""
    run = _build_run()
    first = generate_context_claims(run)
    other_run = _build_run(
        LearningResourceRunFactory.create(
            learning_resource__title=run.learning_resource.title
        )
    )

    second = generate_context_claims(other_run)

    assert second.pk != first.pk
    first.refresh_from_db()
    assert first.unit == run.units.get(kind=Unit.Kind.CONTEXT)
    assert second.unit == other_run.units.get(kind=Unit.Kind.CONTEXT)
    assert len(fake_llm.calls) == 2


def test_changed_context_file_reruns_context(fake_llm):
    """A changed context file reruns the context and replaces its extraction"""
    run = _build_run()
    first = generate_context_claims(run)
    _add_file(run.units.get(kind=Unit.Kind.CONTEXT), "Grading: 50% exams.", position=1)

    assert generate_context_claims(run).key != first.key
    assert ClaimExtraction.objects.count() == 1
    assert len(fake_llm.calls) == 2


def test_context_overwrite(fake_llm):
    """Overwrite calls the model again and replaces the extraction"""
    run = _build_run()
    generate_context_claims(run)

    generate_context_claims(run, overwrite=True)

    assert len(fake_llm.calls) == 2
    assert ClaimExtraction.objects.count() == 1


def test_no_context_unit(fake_llm):
    """A run with no context unit has no extraction"""
    run = LearningResourceRunFactory.create()

    assert generate_context_claims(run) is None
    assert fake_llm.calls == []


def test_context_unit_without_text(fake_llm):
    """A context unit with no text has no extraction"""
    run = LearningResourceRunFactory.create()
    UnitFactory.create(run=run, kind=Unit.Kind.CONTEXT, position=None)

    assert generate_context_claims(run) is None
    assert fake_llm.calls == []


# each of _build_split_run's context files fits the budget, but not both
SPLIT_BUDGET = 60


def _split_budget(budget=SPLIT_BUDGET):
    ResourceProfileConfiguration.objects.filter(
        stage=ResourceProfileConfiguration.Stage.CONTEXT
    ).update(input_token_budget=budget)


def _build_split_run(run=None):
    """Return a run whose context unit has two files"""
    run = _build_run(run)
    _add_file(
        run.units.get(kind=Unit.Kind.CONTEXT),
        "Grading: half of the grade is the exams, half the problem sets.",
        position=1,
    )
    return run


def _parts(run):
    return list(
        ClaimExtraction.objects.filter(
            unit=run.units.get(kind=Unit.Kind.CONTEXT),
            level=ClaimExtraction.Level.UNIT_PART,
        ).order_by("part")
    )


def test_context_over_budget_split(fake_llm):
    """A context unit over the input budget is extracted in parts, then combined"""
    _split_budget()
    run = _build_split_run()

    extraction = generate_context_claims(run)

    assert [name for name, _ in fake_llm.calls] == ["context", "context"]
    first, second = (prompt for _, prompt in fake_llm.calls)
    assert "PART 1 of the course context: sources S01-S01" in first
    assert "=== SOURCE S02" not in first
    assert "PART 2 of the course context: sources S02-S02" in second
    assert "=== SOURCE S01" not in second

    parts = _parts(run)
    assert [part.part for part in parts] == [1, 2]
    assert {part.raw_response for part in parts} == {"context raw"}
    assert extraction.level == ClaimExtraction.Level.UNIT
    assert extraction.part is None
    assert extraction.extractor_version.endswith("-code")
    assert extraction.raw_response == ""

    output = extraction.output
    # each part gives the same claims, so they are combined into one
    assert len(output["stated_audience"]) == 1
    assert [item["source_id"] for item in output["stated_audience"][0]["evidence"]] == [
        "S01",
        "S02",
    ]
    assert len(output["prerequisites"]) == 1
    assert output["instructional_outline"] == [
        {"unit_label": "Week 1", "title": "Kinematics"}
    ]
    assert output["description"]["evidence"][0]["source_id"] == "S01"
    assert output["prerequisites_status"] == "stated"
    assert [source["source_id"] for source in output["sources"]] == ["S01", "S02"]


def _prerequisite(statement, course_ref, source_id):
    return {
        "label": "Calculus",
        "statement": statement,
        "kind": "prerequisite",
        "course_ref": course_ref,
        "evidence": [{"source_id": source_id, "passage": statement, "locator": None}],
    }


def test_merge_keeps_distinct_prerequisites():
    """Prerequisites with one label but other courses are kept apart"""
    first, second = (
        _context_out(
            f"=== SOURCE {source_id} | x ===\nsome source text here"
        ).model_dump()
        for source_id in ("S01", "S02")
    )
    first["prerequisites"] = [_prerequisite("18.01 is required", "18.01", "S01")]
    second["prerequisites"] = [
        _prerequisite("18.02 is required", "18.02", "S02"),
        # the first part's requirement again, differing only in case
        _prerequisite("18.01 is Required.", "18.01", "S02"),
    ]

    prerequisites = merge_context_outputs([first, second], [])["prerequisites"]

    assert [prereq["course_ref"] for prereq in prerequisites] == ["18.01", "18.02"]
    assert [item["source_id"] for item in prerequisites[0]["evidence"]] == [
        "S01",
        "S02",
    ]


def test_split_context_cached(fake_llm):
    """A split context unit whose files haven't changed makes no call"""
    _split_budget()
    run = _build_split_run()
    first = generate_context_claims(run)

    assert generate_context_claims(run) == first
    assert len(fake_llm.calls) == 2
    assert len(_parts(run)) == 2


def test_split_context_reused_by_other_run(fake_llm):
    """Another run of the course with the same files takes over the parts"""
    _split_budget()
    run = _build_split_run()
    first = generate_context_claims(run)
    other_run = _build_split_run(
        LearningResourceRunFactory.create(learning_resource=run.learning_resource)
    )

    reused = generate_context_claims(other_run)

    assert reused.pk == first.pk
    assert reused.unit == other_run.units.get(kind=Unit.Kind.CONTEXT)
    assert [part.part for part in _parts(other_run)] == [1, 2]
    assert len(fake_llm.calls) == 2


def test_split_context_overwrite(fake_llm):
    """Overwrite reruns every part and replaces the combined extraction"""
    _split_budget()
    run = _build_split_run()
    first = generate_context_claims(run)

    second = generate_context_claims(run, overwrite=True)

    assert len(fake_llm.calls) == 4
    assert second.pk == first.pk
    assert len(_parts(run)) == 2


def test_context_no_longer_split(fake_llm):
    """A context unit that fits in one call again loses its parts"""
    _split_budget()
    run = _build_split_run()
    generate_context_claims(run)
    _split_budget(100000)

    extraction = generate_context_claims(run)

    assert _parts(run) == []
    assert extraction.raw_response == "context raw"
    assert ClaimExtraction.objects.count() == 1


def test_failed_unsplit_context_keeps_parts(fake_llm):
    """A context unit no longer split keeps its parts until its call succeeds"""
    _split_budget()
    run = _build_split_run()
    first = generate_context_claims(run)
    _split_budget(100000)
    fake_llm.fail = True

    with pytest.raises(ClaimExtractionError):
        generate_context_claims(run)

    assert [part.part for part in _parts(run)] == [1, 2]
    assert ClaimExtraction.objects.get(
        unit=first.unit, level=ClaimExtraction.Level.UNIT
    ) == (first)


def test_failed_context(mocker):
    """A context unit with no valid response raises, and nothing is stored"""
    mocker.patch.object(claims, "call_llm", FakeLLM(fail=True))

    with pytest.raises(ClaimExtractionError):
        generate_context_claims(_build_run())
    assert not ClaimExtraction.objects.exists()


def test_missing_configuration():
    """Generation needs every stage configured"""
    ResourceProfileConfiguration.objects.filter(stage="context").delete()
    with pytest.raises(ClaimExtractionError, match="context"):
        load_context_extractor()


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
    chat = mocker.patch.object(claims, "ChatLiteLLM")
    chat.return_value.with_structured_output.return_value = structured

    parsed, _ = call_llm(load_context_extractor(), "combined prompt")

    assert parsed.prerequisites == []
    assert len(parsed.extraction_notes) == 1
    assert parsed.extraction_notes[0].startswith(
        "Dropped prerequisites item 1 ('Calculus'), which did not validate: kind:"
    )


def test_call_llm_drops_invalid_description(mocker):
    """An invalid description is dropped and noted, keeping the rest"""
    args = _context_out("=== SOURCE S01 | x ===\nsome source text here").model_dump()
    args["description"]["evidence"] = []
    structured = mocker.Mock()
    structured.invoke.return_value = {
        "raw": AIMessage(
            content="",
            tool_calls=[{"name": "CourseContextOut", "args": args, "id": "call1"}],
        ),
        "parsed": None,
        "parsing_error": ValueError("bad"),
    }
    chat = mocker.patch.object(claims, "ChatLiteLLM")
    chat.return_value.with_structured_output.return_value = structured

    parsed, _ = call_llm(load_context_extractor(), "combined prompt")

    assert parsed.description is None
    assert len(parsed.prerequisites) == 1
    assert parsed.extraction_notes[0].startswith(
        "Dropped description, which did not validate: evidence:"
    )


def _parts_outputs():
    return [
        _context_out(
            f"=== SOURCE {source_id} | x ===\nsome source text here"
        ).model_dump()
        for source_id in ("S01", "S02")
    ]


def test_merge_combines_paraphrased_prerequisites():
    """A prerequisite the parts state in other words is kept once"""
    first, second = _parts_outputs()
    first["prerequisites"] = [_prerequisite("18.01 is required", "18.01", "S01")]
    second["prerequisites"] = [
        _prerequisite("Students must have taken 18.01", "18.01", "S02")
    ]

    [prerequisite] = merge_context_outputs([first, second], [])["prerequisites"]

    assert prerequisite["statement"] == "18.01 is required"
    assert [item["source_id"] for item in prerequisite["evidence"]] == ["S01", "S02"]


def _statement(text, source_id):
    return {
        "text": text,
        "evidence": [{"source_id": source_id, "passage": text, "locator": None}],
    }


def _conflict(topic, statements, assessment):
    return {"topic": topic, "statements": statements, "assessment": assessment}


def test_merge_combines_conflicts_on_one_topic():
    """Conflicts on the same topic are combined, and others are kept apart"""
    first, second = _parts_outputs()
    first["conflicts"] = [
        _conflict(
            "Grading",
            [
                _statement("Exams are 50%", "S01"),
                _statement("Exams are 40%", "S01"),
            ],
            "The syllabus is likely authoritative",
        )
    ]
    second["conflicts"] = [
        _conflict(
            "grading.",
            [
                _statement("Exams are 40%", "S02"),
                _statement("Exams are 60%", "S02"),
            ],
            "Unclear",
        ),
        _conflict(
            "Textbook",
            [_statement("Use Kleppner", "S02"), _statement("Use Halliday", "S02")],
            "Either",
        ),
    ]

    conflicts = merge_context_outputs([first, second], [])["conflicts"]

    assert [conflict["topic"] for conflict in conflicts] == ["Grading", "Textbook"]
    grading = conflicts[0]
    assert grading["assessment"] == "The syllabus is likely authoritative"
    assert [statement["text"] for statement in grading["statements"]] == [
        "Exams are 50%",
        "Exams are 40%",
        "Exams are 60%",
    ]
    assert [item["source_id"] for item in grading["statements"][1]["evidence"]] == [
        "S01",
        "S02",
    ]
