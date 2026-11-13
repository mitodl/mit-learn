"""Tests for generating a run's context claims"""

import re

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
from learning_resources.profiles.context_claims import (
    generate_context_claims,
    load_context_extractor,
    resolve_context_merge,
)
from learning_resources.profiles.schemas import ContextMergeExtraction, CourseContextOut

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


def _merge_out(prompt):
    """Return a merge that combines each list's part items into one"""

    def merged(prefix, **fields):
        ids = re.findall(rf"\[(P\d+:{prefix}\d+)\]", prompt)
        return [{**fields, "part_claim_ids": ids}] if ids else []

    return ContextMergeExtraction.model_validate(
        {
            "title": "Classical Mechanics",
            "stated_audience": merged("aud", text="First-year students"),
            "description": (merged("desc", text="An intro to mechanics") or [None])[0],
            "objectives": merged("obj", text="Objectives"),
            "prerequisites": merged(
                "pre",
                label="Calculus",
                statement="18.01 is required",
                kind="prerequisite",
            ),
            "required_materials": merged("req", text="Materials"),
            "instructional_outline": merged(
                "out", unit_label="Week 1", title="Kinematics"
            ),
            "conflicts": [],
            "extraction_notes": ["Merged notes"],
        }
    )


class FakeLLM:
    """Stands in for call_llm, answering the context and merge extractors"""

    def __init__(self, *, fail=False):
        self.calls = []
        self.fail = fail
        self.fail_merge = False

    def __call__(self, extractor, prompt):
        self.calls.append((extractor.stage, prompt))
        is_merge = extractor.schema is ContextMergeExtraction
        if self.fail or (self.fail_merge and is_merge):
            msg = "bad response"
            raise ClaimExtractionError(msg)
        if is_merge:
            return _merge_out(prompt), "merge raw"
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


def test_context_over_max_parts_skipped(fake_llm, mocker):
    """A context unit that would need more parts than max_parts is skipped"""
    logger = mocker.patch.object(claims, "logger")
    _split_budget()
    ResourceProfileConfiguration.objects.filter(
        stage=ResourceProfileConfiguration.Stage.CONTEXT
    ).update(max_parts=1)
    run = _build_split_run()

    assert generate_context_claims(run) is None
    assert fake_llm.calls == []
    assert not ClaimExtraction.objects.filter(
        unit=run.units.get(kind=Unit.Kind.CONTEXT)
    ).exists()
    message, *args = logger.warning.call_args.args
    assert message.startswith("Skipping")
    assert args[-2:] == [2, 1]


def test_context_over_budget_split(fake_llm):
    """A context unit over the input budget is extracted in parts, then merged"""
    _split_budget()
    run = _build_split_run()

    extraction = generate_context_claims(run)

    assert [name for name, _ in fake_llm.calls] == [
        "context",
        "context",
        "context_merge",
    ]
    first, second, merge = (prompt for _, prompt in fake_llm.calls)
    assert "PART 1 of the course context: sources S01-S01" in first
    assert "=== SOURCE S02" not in first
    assert "PART 2 of the course context: sources S02-S02" in second
    assert "=== SOURCE S01" not in second
    assert "## Part 1 of 2 (sources S01-S01)" in merge
    assert "- [P1:aud1] First-year students" in merge
    assert "- [P2:pre1] [prerequisite] Calculus: 18.01 is required" in merge
    assert "- [P2:out1] Week 1: Kinematics" in merge
    assert "=== SOURCE" not in merge

    parts = _parts(run)
    assert [part.part for part in parts] == [1, 2]
    assert {part.raw_response for part in parts} == {"context raw"}
    assert extraction.level == ClaimExtraction.Level.UNIT
    assert extraction.part is None
    assert extraction.extractor_version.startswith("context_merge-")
    assert extraction.raw_response == "merge raw"

    output = extraction.output
    [audience] = output["stated_audience"]
    assert audience["part_claim_ids"] == ["P1:aud1", "P2:aud1"]
    assert [item["source_id"] for item in audience["evidence"]] == ["S01", "S02"]
    assert len(output["prerequisites"]) == 1
    assert output["instructional_outline"] == [
        {
            "unit_label": "Week 1",
            "title": "Kinematics",
            "part_claim_ids": ["P1:out1", "P2:out1"],
        }
    ]
    assert [item["source_id"] for item in output["description"]["evidence"]] == [
        "S01",
        "S02",
    ]
    assert output["prerequisites_status"] == "stated"
    assert output["extraction_notes"] == ["Merged notes"]
    assert [source["source_id"] for source in output["sources"]] == ["S01", "S02"]
    assert output["part_keys"] == [part.key for part in parts]


def test_context_merge_over_limit_skipped(fake_llm, mocker):
    """
    A context unit whose merge call is over the merge's limit is skipped and
    logged as an error, and keeps its parts
    """
    logger = mocker.patch.object(claims, "logger")
    _split_budget()
    ResourceProfileConfiguration.objects.filter(
        stage=ResourceProfileConfiguration.Stage.CONTEXT_MERGE
    ).update(input_token_budget=10)
    run = _build_split_run()

    assert generate_context_claims(run) is None

    assert [name for name, _ in fake_llm.calls] == ["context", "context"]
    assert len(_parts(run)) == 2
    message, *_ = logger.error.call_args.args
    assert message.startswith("Not merging")


def test_failed_context_merge_fails(fake_llm):
    """
    A context merge with no valid response raises, and the next sweep calls
    only the merge again
    """
    _split_budget()
    run = _build_split_run()
    fake_llm.fail_merge = True

    with pytest.raises(ClaimExtractionError):
        generate_context_claims(run)

    assert len(_parts(run)) == 2
    fake_llm.fail_merge = False
    extraction = generate_context_claims(run)

    assert [name for name, _ in fake_llm.calls] == [
        "context",
        "context",
        "context_merge",
        "context_merge",
    ]
    assert extraction.raw_response == "merge raw"


def test_split_context_cached(fake_llm):
    """A split context unit whose files haven't changed makes no call"""
    _split_budget()
    run = _build_split_run()
    first = generate_context_claims(run)

    assert generate_context_claims(run) == first
    assert len(fake_llm.calls) == 3
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
    assert len(fake_llm.calls) == 3


def test_split_context_overwrite(fake_llm):
    """Overwrite reruns every part and replaces the combined extraction"""
    _split_budget()
    run = _build_split_run()
    first = generate_context_claims(run)

    second = generate_context_claims(run, overwrite=True)

    assert len(fake_llm.calls) == 6
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


def test_unsplit_context_keeps_parts_another_run_cites(fake_llm):
    """
    A context unit no longer split keeps a part it shares with another run's
    context unit whose combined extraction cites it
    """
    _split_budget()
    run = _build_split_run()
    other_run = _build_run(
        LearningResourceRunFactory.create(learning_resource=run.learning_resource)
    )
    other_context = other_run.units.get(kind=Unit.Kind.CONTEXT)
    _add_file(other_context, "Grading: the final exam is the whole grade.", position=1)
    first = generate_context_claims(run)
    generate_context_claims(other_run)
    # the shared first part is pointed at the other run, which used it last
    shared = _parts(other_run)[0]
    assert first.output["part_keys"][0] == shared.key
    calls = len(fake_llm.calls)

    other_context.unitcontentfile_set.get(position=1).delete()
    generate_context_claims(other_run)

    assert _parts(other_run) == [shared]
    assert generate_context_claims(run) == first
    assert len(fake_llm.calls) == calls + 1
    assert [part.part for part in _parts(run)] == [1, 2]


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


def _prerequisite(statement, course_ref, source_id):
    return {
        "label": "Calculus",
        "statement": statement,
        "kind": "prerequisite",
        "course_ref": course_ref,
        "evidence": [{"source_id": source_id, "passage": statement, "locator": None}],
    }


def _statement(text, source_id):
    return {
        "text": text,
        "evidence": [{"source_id": source_id, "passage": text, "locator": None}],
    }


def _conflict(topic, statements, assessment):
    return {"topic": topic, "statements": statements, "assessment": assessment}


def _part_rows(outputs):
    unit = UnitFactory.create(kind=Unit.Kind.CONTEXT)
    return [
        ClaimExtractionFactory.create(
            unit=unit, level=ClaimExtraction.Level.UNIT_PART, part=index, output=output
        )
        for index, output in enumerate(outputs, 1)
    ]


def _merge_output(**fields):
    """Return a merge output with no items but these"""
    return {
        "title": "",
        "stated_audience": [],
        "description": None,
        "objectives": [],
        "prerequisites": [],
        "required_materials": [],
        "instructional_outline": [],
        "conflicts": [],
        "extraction_notes": [],
        **fields,
    }


def test_resolve_merge_checks_citations():
    """
    Merged items carry the evidence of the part items they cite, an item
    citing none of its list is dropped, and part items the merge leaves out
    are added back, each on its own
    """
    first, second = _parts_outputs()
    first["prerequisites"] = [_prerequisite("18.01 is required", "18.01", "S01")]
    second["prerequisites"] = [
        _prerequisite("18.02 is required", "18.02", "S02"),
        _prerequisite("Students must have taken 18.01", "18.01", "S02"),
    ]
    second["prerequisites_status"] = "not_found"
    parts = _part_rows([first, second])
    output = _merge_output(
        stated_audience=[
            {"text": "First-year students", "part_claim_ids": ["P1:aud1", "p2: aud1"]}
        ],
        objectives=[{"text": "Invented", "part_claim_ids": ["P1:aud1"]}],
        prerequisites=[
            {
                "label": "Calculus",
                "statement": "18.01 is required",
                "kind": "prerequisite",
                "course_ref": "18.01",
                "part_claim_ids": ["P1:pre1", "P2:pre2"],
            }
        ],
    )

    output = resolve_context_merge(output, parts)

    [audience] = output["stated_audience"]
    assert audience["part_claim_ids"] == ["P1:aud1", "P2:aud1"]
    assert [item["source_id"] for item in audience["evidence"]] == ["S01", "S02"]
    assert output["objectives"] == []
    assert [
        (item["course_ref"], item["part_claim_ids"]) for item in output["prerequisites"]
    ] == [("18.01", ["P1:pre1", "P2:pre2"]), ("18.02", ["P2:pre1"])]
    assert [item["source_id"] for item in output["prerequisites"][0]["evidence"]] == [
        "S01",
        "S02",
    ]
    # each part's outline entry is added back, and the first part's description
    assert [item["part_claim_ids"] for item in output["instructional_outline"]] == [
        ["P1:out1"],
        ["P2:out1"],
    ]
    assert output["description"]["part_claim_ids"] == ["P1:desc1"]
    assert output["title"] == "Classical Mechanics"
    assert output["prerequisites_status"] == "stated"
    assert output["part_keys"] == [part.key for part in parts]
    notes = output["extraction_notes"]
    assert any(note.startswith("Dropped merged objectives item") for note in notes)
    assert "Added back prerequisites the merge left out: P2:pre1" in notes
    assert "Added back description the merge left out: P1:desc1" in notes
    assert (
        "Added back instructional outline the merge left out: P1:out1, P2:out1" in notes
    )


def test_resolve_merge_conflicts_between_parts():
    """
    A merged conflict may cite statements of any list from different parts,
    one left with fewer than two is dropped, and a part's conflict the merge
    leaves out is added back
    """
    first, second = _parts_outputs()
    first["required_materials"] = [_statement("Exams are 50% of the grade", "S01")]
    second["required_materials"] = [_statement("Exams are 40% of the grade", "S02")]
    second["conflicts"] = [
        _conflict(
            "Textbook",
            [_statement("Use Kleppner", "S02"), _statement("Use Halliday", "S02")],
            "Either",
        )
    ]
    parts = _part_rows([first, second])
    output = _merge_output(
        required_materials=[
            {"text": "Exams are 50% of the grade", "part_claim_ids": ["P1:req1"]},
            {"text": "Exams are 40% of the grade", "part_claim_ids": ["P2:req1"]},
        ],
        conflicts=[
            _conflict(
                "Grading",
                [
                    {"text": "Exams are 50%", "part_claim_ids": ["P1:req1"]},
                    {"text": "Exams are 40%", "part_claim_ids": ["P2:req1"]},
                ],
                "Unclear",
            ),
            # an outline entry isn't a statement
            _conflict(
                "Invented",
                [
                    {"text": "Week 1", "part_claim_ids": ["P1:out1"]},
                    {"text": "Exams are 40%", "part_claim_ids": ["P2:req1"]},
                ],
                "Unclear",
            ),
        ],
    )

    conflicts = resolve_context_merge(output, parts)["conflicts"]

    assert [conflict["topic"] for conflict in conflicts] == ["Grading", "Textbook"]
    grading, textbook = conflicts
    assert [
        statement["evidence"][0]["source_id"] for statement in grading["statements"]
    ] == ["S01", "S02"]
    assert [statement["part_claim_ids"] for statement in textbook["statements"]] == [
        ["P2:cs1"],
        ["P2:cs2"],
    ]
    notes = output["extraction_notes"]
    assert any(note.startswith("Dropped merged conflict 'Invented'") for note in notes)
    assert (
        "Added back conflicts the merge left out, with their first statements: P2:cs1"
        in notes
    )
