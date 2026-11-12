"""Tests for step 2 of resource profile generation: claims about a run"""

import pytest

from learning_resources.factories import (
    ClaimExtractionFactory,
    LearningResourceRunFactory,
    UnitFactory,
)
from learning_resources.models import (
    ClaimExtraction,
    ResourceProfileConfiguration,
    Unit,
)
from learning_resources.profiles import claims
from learning_resources.profiles.run_claims import (
    generate_run_claims,
    split_inferred_preparation,
    unit_records,
)
from learning_resources.profiles.schemas import RunExtraction

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def configuration():
    """Configure the run stage"""
    ResourceProfileConfiguration.objects.update_or_create(
        stage=ResourceProfileConfiguration.Stage.RUN,
        defaults={"llm_model": "test-model", "prompt": "run prompt"},
    )


def _concept(claim_id, label, status="taught"):
    return {
        "id": claim_id,
        "label": label,
        "description": f"About {label}.",
        "kind": "concept",
        "teaching_status": status,
        "evidence": [{"source_id": "S01", "passage": "a quoted passage here"}],
    }


def _assumed(claim_id, label):
    return {
        "id": claim_id,
        "label": label,
        "description": f"Relies on {label}.",
        "how_used": "in worked examples",
        "flagged_as_prior": False,
        "evidence": [{"source_id": "S01", "passage": "a quoted passage here"}],
    }


def _skill(claim_id, label):
    return {
        "id": claim_id,
        "label": label,
        "description": f"Can {label}.",
        "evidence": [{"source_id": "S01", "passage": "a quoted passage here"}],
    }


def _unit_output(concepts=(), assumed=(), skills=(), files=1, truncated=0):
    return {
        "summary": "The unit teaches mechanics.",
        "concepts": list(concepts),
        "skills": list(skills),
        "assumed_knowledge": list(assumed),
        "assessment_expectations": [],
        "extraction_notes": [],
        "sources": [
            {"source_id": f"S{index:02d}", "truncated": index < truncated}
            for index in range(files)
        ],
    }


CONTEXT_OUTPUT = {
    "title": "Mechanics",
    "stated_audience": [{"text": "First-year students", "evidence": []}],
    "description": {"text": "An introduction to mechanics", "evidence": []},
    "objectives": [],
    "prerequisites_status": "stated",
    "prerequisites": [
        {
            "label": "Calculus",
            "statement": "18.01 is required",
            "kind": "prerequisite",
            "course_ref": "18.01",
            "evidence": [],
        }
    ],
    "required_materials": [],
    "instructional_outline": [],
    "conflicts": [],
    "extraction_notes": [],
    "sources": [],
}


def _extraction(unit, output):
    return ClaimExtractionFactory.create(unit=unit, output=output)


@pytest.fixture
def run_inputs():
    """Return a run with a context unit and two units out of position order"""
    run = LearningResourceRunFactory.create()
    context_unit = UnitFactory.create(
        run=run, kind=Unit.Kind.CONTEXT, external_id="context", position=None
    )
    second = UnitFactory.create(run=run, title="Week 2", position=2)
    first = UnitFactory.create(run=run, title="Week 1", position=1)
    extractions = [
        (
            second,
            _extraction(
                second,
                _unit_output(
                    concepts=[_concept("c1", "Newton's second law")],
                    assumed=[_assumed("a1", "Vector components")],
                    skills=[_skill("s1", "Draw a free-body diagram")],
                ),
            ),
        ),
        (
            first,
            _extraction(
                first,
                _unit_output(
                    concepts=[_concept("c1", "Vector components")],
                    assumed=[_assumed("a1", "Derivatives")],
                    files=2,
                    truncated=1,
                ),
            ),
        ),
    ]
    context = _extraction(context_unit, CONTEXT_OUTPUT)
    return run, context, extractions


def _response(**fields):
    defaults = {
        "summary": "A course on mechanics.",
        "summary_claim_ids": ["U01:c1"],
        "audience": [{"text": "First-year students", "claim_ids": ["ctx:aud:0"]}],
        "main_topics": [
            {
                "label": "Dynamics",
                "description": "Forces",
                "unit_ids": ["U02"],
                "concept_claim_ids": ["U02:c1"],
            }
        ],
        "learning_outcomes": [
            {"text": "Draw free-body diagrams", "claim_ids": ["U02:s1"]}
        ],
        "inferred_preparation": [],
        "coverage_limitations": [],
    }
    return RunExtraction.model_validate({**defaults, **fields})


@pytest.fixture
def fake_llm(mocker):
    """Replace the model with one that gives a fixed run extraction"""
    return mocker.patch.object(
        claims, "call_llm", return_value=(_response(), "run raw")
    )


def _prompt(fake_llm, call=0):
    return fake_llm.call_args_list[call].args[1]


def test_generate_run_claims(fake_llm, run_inputs):
    """The run's claims are generated from its units' and context's claims"""
    run, context, extractions = run_inputs

    extraction = generate_run_claims(run, context, extractions)

    prompt = _prompt(fake_llm)
    # units in course order; claim ids prefixed by the unit
    assert prompt.index("## U01 Week 1") < prompt.index("## U02 Week 2")
    assert "[U02:c1] [taught] Newton's second law" in prompt
    assert "[ctx:prereq:0] [prerequisite] 18.01 is required" in prompt
    assert (extraction.level, extraction.run, extraction.unit) == (
        ClaimExtraction.Level.RUN,
        run,
        None,
    )
    output = extraction.output
    assert output["summary"] == "A course on mechanics."
    assert output["declared_prerequisites"]["items"][0]["claim_id"] == "ctx:prereq:0"
    assert [concept["claim_id"] for concept in output["concepts"]] == [
        "U01:c1",
        "U02:c1",
    ]
    assert [(unit["unit_id"], unit["unit"]) for unit in output["units"]] == [
        ("U01", extractions[1][0].id),
        ("U02", extractions[0][0].id),
    ]
    assert output["context_extraction"] == context.id


def test_run_claims_cached(fake_llm, run_inputs):
    """A run whose inputs haven't changed makes no call"""
    run, context, extractions = run_inputs
    first = generate_run_claims(run, context, extractions)

    assert generate_run_claims(run, context, extractions) == first
    assert fake_llm.call_count == 1


def test_cached_run_refers_to_new_run(fake_llm, run_inputs):
    """A run reusing another run's row has its citations point at its own units"""
    run, context, extractions = run_inputs
    first = generate_run_claims(run, context, extractions)
    new_run = LearningResourceRunFactory.create(learning_resource=run.learning_resource)
    # the unit step moves each shared unit extraction to the new run's unit
    moved = []
    for unit, extraction in extractions:
        new_unit = UnitFactory.create(
            run=new_run, title=unit.title, position=unit.position
        )
        extraction.unit = new_unit
        extraction.save()
        moved.append((new_unit, extraction))

    extraction = generate_run_claims(new_run, context, moved)

    assert fake_llm.call_count == 1
    assert extraction.pk == first.pk
    assert extraction.run == new_run
    assert [unit["unit"] for unit in extraction.output["units"]] == [
        moved[1][0].id,
        moved[0][0].id,
    ]
    extraction.refresh_from_db()
    assert extraction.output["units"][0]["unit"] == moved[1][0].id
    assert extraction.output["summary"] == "A course on mechanics."


def test_changed_unit_reruns_run(fake_llm, run_inputs):
    """A unit extraction with a new key reruns the run, replacing its row"""
    run, context, extractions = run_inputs
    first = generate_run_claims(run, context, extractions)
    ClaimExtraction.objects.filter(pk=extractions[0][1].pk).update(key="f" * 64)
    extractions[0][1].refresh_from_db()

    extraction = generate_run_claims(run, context, extractions)

    assert extraction.pk == first.pk
    assert extraction.key != first.key
    assert fake_llm.call_count == 2


@pytest.mark.parametrize("changed", ["unit", "context"])
def test_changed_output_same_key_reruns_run(fake_llm, run_inputs, changed):
    """An extraction regenerated under the same key reruns the run"""
    run, context, extractions = run_inputs
    first = generate_run_claims(run, context, extractions)
    extraction = extractions[0][1] if changed == "unit" else context
    ClaimExtraction.objects.filter(pk=extraction.pk).update(
        output={**extraction.output, "summary": "Regenerated."}
    )
    extraction.refresh_from_db()

    rerun = generate_run_claims(run, context, extractions)

    assert rerun.key != first.key
    assert fake_llm.call_count == 2


def test_run_key_stable_after_reload(fake_llm, run_inputs):
    """Outputs read back from the database, keys reordered, keep the run's key"""
    run, context, extractions = run_inputs
    first = generate_run_claims(run, context, extractions)
    for _, extraction in extractions:
        extraction.refresh_from_db()
    context.refresh_from_db()

    assert generate_run_claims(run, context, extractions).key == first.key
    assert fake_llm.call_count == 1


def test_same_title_in_other_course_keyed_apart(fake_llm, run_inputs):
    """Another course with the same inputs gets its own run extraction"""
    run, context, extractions = run_inputs
    first = generate_run_claims(run, context, extractions)
    other = LearningResourceRunFactory.create(
        learning_resource__title=run.learning_resource.title
    )

    second = generate_run_claims(other, context, extractions)

    assert second.pk != first.pk
    first.refresh_from_db()
    assert (first.run, second.run) == (run, other)


def test_no_unit_claims(fake_llm):
    """A run whose units were all skipped has no run claims"""
    run = LearningResourceRunFactory.create()
    unit = UnitFactory.create(run=run)

    assert generate_run_claims(run, None, [(unit, None)]) is None
    assert fake_llm.call_count == 0


def test_skipped_unit_in_prompt(fake_llm, run_inputs):
    """A skipped unit is listed as not processed"""
    run, context, extractions = run_inputs
    skipped = UnitFactory.create(run=run, title="Week 3", position=3)

    generate_run_claims(run, context, [*extractions, (skipped, None)])

    assert "## U03 Week 3 (unit 3): NOT PROCESSED" in _prompt(fake_llm)


def test_cited_teaching_excludes_preparation(fake_llm, run_inputs):
    """The model's cited teaching claims, once checked, exclude preparation"""
    run, context, extractions = run_inputs
    fake_llm.return_value = (
        _response(
            inferred_preparation=[
                _preparation(
                    "Vector components",
                    ["U02:a1"],
                    "U02",
                    taught_before_first_use_claim_ids=["U01:c1", "U09:c9"],
                ),
            ]
        ),
        "run raw",
    )

    output = generate_run_claims(run, context, extractions).output

    assert output["inferred_preparation"] == []
    (excluded,) = output["excluded_inferred_preparation"]
    assert excluded["taught_before_first_use_claim_ids"] == ["U01:c1"]
    assert "U09:c9" in output["extraction_notes"][0]


def test_unknown_ids_dropped(fake_llm, run_inputs):
    """Cited ids not in the input are dropped, with what they alone supported"""
    run, context, extractions = run_inputs
    fake_llm.return_value = (
        _response(
            summary_claim_ids=["U01:c1", "U09:c1"],
            audience=[{"text": "Made up", "claim_ids": ["ctx:aud:7"]}],
            learning_outcomes=[
                {"text": "Grounded", "claim_ids": ["U02:s1"]},
                # assumed knowledge doesn't show the course teaches anything
                {"text": "Ungrounded", "claim_ids": ["U02:a1"]},
            ],
            main_topics=[
                {
                    "label": "Nothing",
                    "description": "",
                    "unit_ids": ["U01"],
                    "concept_claim_ids": ["U05:c2"],
                }
            ],
        ),
        "run raw",
    )

    output = generate_run_claims(run, context, extractions).output

    assert output["summary_claim_ids"] == ["U01:c1"]
    assert output["audience"] == []
    assert [item["text"] for item in output["learning_outcomes"]] == ["Grounded"]
    assert output["main_topics"] == []
    notes = output["extraction_notes"]
    assert notes[0] == "Dropped unknown ids: U05:c2, U09:c1, ctx:aud:7"
    assert any("Ungrounded" in note for note in notes)
    assert "Summary cites no known claim" not in notes


def test_context_notes_only_supports_limitations(fake_llm, run_inputs):
    """ctx:notes backs a coverage limitation, but nothing else"""
    run, context, extractions = run_inputs
    fake_llm.return_value = (
        _response(
            summary_claim_ids=["ctx:notes"],
            audience=[{"text": "Anyone", "claim_ids": ["ctx:notes"]}],
            coverage_limitations=[{"text": "No solutions", "claim_ids": ["ctx:notes"]}],
        ),
        "run raw",
    )

    output = generate_run_claims(run, context, extractions).output

    assert output["summary_claim_ids"] == []
    assert output["audience"] == []
    # the code adds a limitation for the truncated file after it
    assert output["coverage_limitations"][0] == {
        "text": "No solutions",
        "claim_ids": ["ctx:notes"],
    }
    notes = output["extraction_notes"]
    assert notes[0] == "Dropped unknown ids: ctx:notes"
    assert "Summary cites no known claim" in notes
    assert any("Anyone" in note for note in notes)


def test_summary_without_known_ids_noted(fake_llm, run_inputs):
    """A summary whose cited ids are all unknown is kept, with a note"""
    run, context, extractions = run_inputs
    fake_llm.return_value = (_response(summary_claim_ids=["U09:c1"]), "run raw")

    output = generate_run_claims(run, context, extractions).output

    assert output["summary"] == "A course on mechanics."
    assert output["summary_claim_ids"] == []
    assert output["extraction_notes"] == [
        "Dropped unknown ids: U09:c1",
        "Summary cites no known claim",
    ]


def _preparation(label, assumed, first_needed=None, **fields):
    return {
        "label": label,
        "description": "",
        "rationale": "",
        "first_needed_unit_id": first_needed,
        "assumed_claim_ids": assumed,
        "taught_before_first_use_claim_ids": [],
        "taught_after_first_use_claim_ids": [],
        "confidence": "high",
        "only_needed_for_optional_material": False,
        **fields,
    }


def test_preparation_rule(run_inputs):
    """Preparation the model says is taught by first use is dropped"""
    _, _, extractions = run_inputs
    records = unit_records(extractions)

    kept, excluded = split_inferred_preparation(
        [
            # assumed in U02, taught in U01
            _preparation(
                "Vector components",
                ["U02:a1"],
                "U02",
                taught_before_first_use_claim_ids=["U01:c1"],
            ),
            # assumed in U01, taught only later
            _preparation(
                "Newton's second law",
                ["U01:a1"],
                "U01",
                taught_after_first_use_claim_ids=["U02:c1"],
            ),
            # assumed in U01, taught nowhere
            _preparation("Derivatives", ["U01:a1"], "U01"),
        ],
        records,
    )

    assert [(item["label"], item["first_needed_unit_id"]) for item in kept] == [
        ("Newton's second law", "U01"),
        ("Derivatives", "U01"),
    ]
    assert kept[0]["taught_after_first_use_claim_ids"] == ["U02:c1"]
    assert "sequencing gap" in kept[0]["review_note"]
    assert [(item["label"], item["first_needed_unit_id"]) for item in excluded] == [
        ("Vector components", "U02"),
    ]
    assert excluded[0]["taught_before_first_use_claim_ids"] == ["U01:c1"]


def test_preparation_rule_earliest_first_use(run_inputs):
    """A cited claim before the model's first-needed unit is reported as first use"""
    _, _, extractions = run_inputs
    records = unit_records(extractions)

    # the model says U02, but cites an assumed claim of U01; U02 teaches it
    kept, excluded = split_inferred_preparation(
        [
            _preparation(
                "Newton's second law",
                ["U01:a1"],
                "U02",
                taught_after_first_use_claim_ids=["U02:c1"],
            )
        ],
        records,
    )

    assert excluded == []
    assert [(item["label"], item["first_needed_unit_id"]) for item in kept] == [
        ("Newton's second law", "U01"),
    ]
    assert kept[0]["taught_after_first_use_claim_ids"] == ["U02:c1"]


def test_preparation_only_teaching_claims(fake_llm, run_inputs):
    """Cited claims that aren't taught or reviewed concepts don't drop an item"""
    run, context, extractions = run_inputs
    fake_llm.return_value = (
        _response(
            inferred_preparation=[
                # a skill and an assumed claim, both in or before the first use
                _preparation(
                    "Statics",
                    ["U02:a1"],
                    "U02",
                    taught_before_first_use_claim_ids=["U02:s1", "U01:a1"],
                ),
            ]
        ),
        "run raw",
    )

    output = generate_run_claims(run, context, extractions).output

    assert output["excluded_inferred_preparation"] == []
    (item,) = output["inferred_preparation"]
    assert item["taught_before_first_use_claim_ids"] == []
    assert item["taught_after_first_use_claim_ids"] == []
    # known ids, so not reported as unknown
    assert not any("unknown" in note for note in output["extraction_notes"])


def test_limitations(fake_llm, run_inputs):
    """Truncated files are stated as a limitation"""
    run, context, extractions = run_inputs

    limitations = generate_run_claims(run, context, extractions).output[
        "coverage_limitations"
    ]

    assert [item["text"] for item in limitations] == [
        "Files too long to read in full, read only in part: 1.",
    ]
