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
    apply_preparation_rule,
    generate_run_claims,
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
    """Return a run with a context unit, two units out of position order, and a bin"""
    run = LearningResourceRunFactory.create()
    context_unit = UnitFactory.create(
        run=run, kind=Unit.Kind.CONTEXT, external_id="context", position=None
    )
    second = UnitFactory.create(run=run, title="Week 2", position=2)
    first = UnitFactory.create(run=run, title="Week 1", position=1)
    bin_unit = UnitFactory.create(
        run=run, kind=Unit.Kind.BIN, title="Readings", position=None
    )
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
                ),
            ),
        ),
        (
            bin_unit,
            _extraction(
                bin_unit,
                _unit_output(assumed=[_assumed("a1", "Kinematics")], truncated=1),
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
        "unresolved_conflicts": [],
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
    # units in course order, then bins; claim ids prefixed by the unit
    assert prompt.index("## U01 Week 1") < prompt.index("## U02 Week 2")
    assert prompt.index("## U02 Week 2") < prompt.index("## B01 Readings")
    assert "[U02:c1] [taught] Newton's second law" in prompt
    assert "[B01:a1] Kinematics" in prompt
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
        ("B01", extractions[2][0].id),
    ]
    assert output["context_extraction"] == context.id


def test_run_claims_cached(fake_llm, run_inputs):
    """A run whose inputs haven't changed makes no call"""
    run, context, extractions = run_inputs
    first = generate_run_claims(run, context, extractions)

    assert generate_run_claims(run, context, extractions) == first
    assert fake_llm.call_count == 1


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


def test_bin_order_keeps_key(fake_llm):
    """Rebuilding bins in another order reuses the run's claims"""
    run = LearningResourceRunFactory.create()
    bins = UnitFactory.create_batch(
        2, run=run, kind=Unit.Kind.BIN, position=None, title="Bin"
    )
    extractions = [(unit, _extraction(unit, _unit_output())) for unit in bins]
    first = generate_run_claims(run, None, extractions)

    assert generate_run_claims(run, None, list(reversed(extractions))) == first
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
                    taught_in_claim_ids=["U01:c1", "U09:c9"],
                ),
            ]
        ),
        "run raw",
    )

    output = generate_run_claims(run, context, extractions).output

    assert output["inferred_preparation"] == []
    (excluded,) = output["excluded_inferred_preparation"]
    assert excluded["taught_in_claim_ids"] == ["U01:c1"]
    assert excluded["code_check_taught_in"] == ["U01:c1"]
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


def _preparation(label, assumed, first_needed=None, **fields):
    return {
        "label": label,
        "description": "",
        "rationale": "",
        "first_needed_unit_id": first_needed,
        "assumed_claim_ids": assumed,
        "taught_in_claim_ids": [],
        "confidence": "high",
        "only_needed_for_optional_material": False,
        **fields,
    }


def test_preparation_rule(run_inputs):
    """Preparation taught at or before first use is dropped; bins count anywhere"""
    _, _, extractions = run_inputs
    records = unit_records(extractions)

    kept, excluded = apply_preparation_rule(
        [
            # assumed in U02, taught in U01
            _preparation(
                "Vector components", ["U02:a1"], "U02", taught_in_claim_ids=["U01:c1"]
            ),
            # assumed in U01, taught only later
            _preparation(
                "Newton's second law",
                ["U01:a1"],
                "U01",
                taught_in_claim_ids=["U02:c1"],
            ),
            # assumed only in a bin, taught in U02
            _preparation(
                "Newton's second law",
                ["B01:a1"],
                "B01",
                taught_in_claim_ids=["U02:c1"],
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
    assert kept[0]["code_check_taught_later_in"] == ["U02:c1"]
    assert "sequencing gap" in kept[0]["review_note"]
    assert [(item["label"], item["first_needed_unit_id"]) for item in excluded] == [
        ("Vector components", "U02"),
        ("Newton's second law", None),
    ]
    assert excluded[0]["code_check_taught_in"] == ["U01:c1"]


def test_preparation_rule_earliest_first_use(run_inputs):
    """A cited claim before the model's first-needed unit sets the first use"""
    _, _, extractions = run_inputs
    records = unit_records(extractions)

    # the model says U02, but cites an assumed claim of U01; U02 teaches it
    kept, excluded = apply_preparation_rule(
        [
            _preparation(
                "Newton's second law",
                ["U01:a1"],
                "U02",
                taught_in_claim_ids=["U02:c1"],
            )
        ],
        records,
    )

    assert excluded == []
    assert [(item["label"], item["first_needed_unit_id"]) for item in kept] == [
        ("Newton's second law", "U01"),
    ]
    assert kept[0]["code_check_taught_later_in"] == ["U02:c1"]


def test_preparation_rule_only_teaching_claims(run_inputs):
    """Cited claims that aren't taught or reviewed concepts don't drop an item"""
    _, _, extractions = run_inputs
    records = unit_records(extractions)

    # a skill and an assumed claim, both in or before the first use
    kept, excluded = apply_preparation_rule(
        [
            _preparation(
                "Statics",
                ["U02:a1"],
                "U02",
                taught_in_claim_ids=["U02:s1", "U01:a1"],
            )
        ],
        records,
    )

    assert excluded == []
    assert kept[0]["code_check_taught_in"] == []
    assert kept[0]["code_check_taught_later_in"] == []


def test_limitations(fake_llm, run_inputs):
    """Bins and truncated files are stated as limitations"""
    run, context, extractions = run_inputs

    limitations = generate_run_claims(run, context, extractions).output[
        "coverage_limitations"
    ]

    assert [item["text"] for item in limitations] == [
        (
            "3 of 4 files were in ordered units; preparation for the 1 in bins was"
            " judged course-wide."
        ),
        "Files over the per-file limit, read only in part: 1.",
    ]
