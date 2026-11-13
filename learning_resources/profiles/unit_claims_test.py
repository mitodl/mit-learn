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
            "assumed_knowledge": [_merged("Algebra", ["P1:a2", "P2:a2"], **assumed)],
            # each part assumes Newton's second law, which the parts teach
            "taught_assumed_knowledge": [
                {"part_claim_id": "P1:a1", "taught_by": ["P1:c1"]},
                {"part_claim_id": "P2:a1", "taught_by": ["P2:c1"]},
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


def test_split_unit_logged(fake_llm, mocker):
    """A unit that is split is logged with its number of parts"""
    logger = mocker.patch.object(claims, "logger")
    _split_budget()

    _generate(_build_unit())

    [split] = [
        call.args
        for call in logger.info.call_args_list
        if call.args[0].startswith("Splitting")
    ]
    assert split[-1] == 2
    assert not any(
        call.args[0].startswith("Skipping") for call in logger.warning.call_args_list
    )


@pytest.mark.parametrize("max_parts", [1, 0])
def test_unit_over_max_parts_skipped(fake_llm, mocker, max_parts):
    """A unit that would need more parts than max_parts is skipped"""
    logger = mocker.patch.object(claims, "logger")
    _split_budget()
    ResourceProfileConfiguration.objects.filter(
        stage=ResourceProfileConfiguration.Stage.UNIT
    ).update(max_parts=max_parts)
    unit = _build_unit()

    assert _generate(unit) is None
    fake_llm.assert_not_called()
    assert not ClaimExtraction.objects.filter(unit=unit).exists()
    message, *args = logger.warning.call_args.args
    assert message.startswith("Skipping")
    assert args[-2:] == [2, max_parts]


def test_unsplit_unit_ignores_max_parts(fake_llm):
    """A unit that fits in one call is extracted whatever max_parts is"""
    ResourceProfileConfiguration.objects.filter(
        stage=ResourceProfileConfiguration.Stage.UNIT
    ).update(max_parts=0)

    assert _generate(_build_unit()) is not None
    assert fake_llm.call_count == 1


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
    # the assumed items the merge says the unit teaches are left out, and
    # flagged_as_prior is kept from the part that set it
    [assumed] = output["assumed_knowledge"]
    assert assumed["label"] == "Algebra"
    assert assumed["id"] == "a1"
    assert assumed["flagged_as_prior"] is True
    assert output["taught_assumed_knowledge"] == [
        {"part_claim_id": "P1:a1", "taught_by": ["P1:c1"]},
        {"part_claim_id": "P2:a1", "taught_by": ["P2:c1"]},
    ]
    notes = output["extraction_notes"]
    assert notes[0] == "Merged notes"
    assert any("'Invented'" in note for note in notes)
    assert any("'Mislabeled'" in note for note in notes)
    assert not any(note.startswith(("Added back", "Kept")) for note in notes)


def test_merge_cannot_strengthen_part_claims(fake_llm):
    """
    The merge's own status and prior flag are replaced by the cited claims',
    and assumed knowledge it says a merely mentioned concept teaches is kept
    """

    def answer(extractor, prompt):
        parsed, raw = _answer(extractor, prompt)
        output = parsed.model_dump()
        if extractor.schema is UnitMergeExtraction:
            output["concepts"][0]["teaching_status"] = "taught"
            for item in output["assumed_knowledge"]:
                item["flagged_as_prior"] = True
        else:
            for concept in output["concepts"]:
                concept["teaching_status"] = "mentioned"
            for item in output["assumed_knowledge"]:
                item["flagged_as_prior"] = False
        return extractor.schema.model_validate(output), raw

    fake_llm.side_effect = answer
    _split_budget()

    output = _generate(_build_unit()).output

    [concept] = output["concepts"]
    assert concept["teaching_status"] == "mentioned"
    # no part teaches Newton's second law, so the parts' assumed items for it
    # are kept, and none is flagged, like the parts' items
    assert [item["part_claim_ids"] for item in output["assumed_knowledge"]] == [
        ["P1:a2", "P2:a2"],
        ["P1:a1"],
        ["P2:a1"],
    ]
    assert not any(item["flagged_as_prior"] for item in output["assumed_knowledge"])
    assert output["taught_assumed_knowledge"] == []


def _answer_merge(merge_output):
    """Answer like _answer, but with this merge output"""

    def answer(extractor, prompt):
        if extractor.schema is UnitMergeExtraction:
            return UnitMergeExtraction.model_validate(merge_output), "merge raw"
        return _answer(extractor, prompt)

    return answer


@pytest.mark.parametrize(
    ("taught_by", "kept"),
    [
        (["P2:c1"], False),
        # written another way
        (["p2: c1"], False),
        # a skill, not a concept
        (["P1:s1"], True),
        (["P9:c1"], True),
    ],
)
def test_taught_assumed_knowledge_checked(fake_llm, taught_by, kept):
    """
    An assumed item the merge leaves out is left out only when the merge
    cites a part concept that teaches or reviews it
    """
    output = _merge_out("").model_dump()
    output["taught_assumed_knowledge"][0]["taught_by"] = taught_by
    fake_llm.side_effect = _answer_merge(output)
    _split_budget()

    output = _generate(_build_unit()).output

    assumed_ids = [item["part_claim_ids"] for item in output["assumed_knowledge"]]
    assert (["P1:a1"] in assumed_ids) is kept
    assert [entry["part_claim_id"] for entry in output["taught_assumed_knowledge"]] == (
        ["P2:a1"] if kept else ["P1:a1", "P2:a1"]
    )
    notes = output["extraction_notes"]
    assert any(note.startswith("Kept assumed knowledge 'P1:a1'") for note in notes) is (
        kept
    )


def test_taught_assumed_item_cited_by_merge_kept(fake_llm):
    """An assumed item the merge both keeps and says the unit teaches is kept"""
    output = _merge_out("").model_dump()
    output["assumed_knowledge"][0]["part_claim_ids"].append("P1:a1")
    fake_llm.side_effect = _answer_merge(output)
    _split_budget()

    output = _generate(_build_unit()).output

    [assumed] = output["assumed_knowledge"]
    assert assumed["part_claim_ids"] == ["P1:a2", "P2:a2", "P1:a1"]
    assert [entry["part_claim_id"] for entry in output["taught_assumed_knowledge"]] == [
        "P2:a1"
    ]


def test_merge_finds_variants_of_part_claim_ids(fake_llm):
    """Part claim ids the model writes another way are still found"""
    output = _merge_out("").model_dump()
    output["concepts"] = [
        _merged(
            "Newton's 2nd law",
            ["p1:c1", "[P2: c1]", "P02:C01"],
            kind="concept",
            teaching_status="taught",
        )
    ]
    fake_llm.side_effect = _answer_merge(output)
    _split_budget()

    output = _generate(_build_unit()).output

    [concept] = output["concepts"]
    assert concept["label"] == "Newton's 2nd law"
    assert concept["part_claim_ids"] == ["P1:c1", "P2:c1"]
    assert len(concept["evidence"]) == 2
    assert not any(note.startswith("Added back") for note in output["extraction_notes"])


def test_merge_left_out_claims_added_back(fake_llm):
    """
    Part claims the merge leaves out without a reason are added back, each
    as a claim of its own: code doesn't compare labels
    """
    output = _merge_out("").model_dump()
    output["concepts"] = []
    output["skills"] = [_merged("Free-body diagrams", ["P1:s1"])]
    output["assumed_knowledge"] = [
        _merged(
            "Algebra",
            ["P1:a2"],
            how_used="Used without explanation",
            flagged_as_prior=False,
        )
    ]
    output["taught_assumed_knowledge"] = []
    fake_llm.side_effect = _answer_merge(output)
    _split_budget()

    output = _generate(_build_unit()).output

    assert [
        (concept["label"], concept["part_claim_ids"], concept["teaching_status"])
        for concept in output["concepts"]
    ] == [
        ("Newton's second law", ["P1:c1"], "taught"),
        ("Newton's second law", ["P2:c1"], "taught"),
    ]
    assert [len(concept["evidence"]) for concept in output["concepts"]] == [1, 1]
    assert [
        (skill["label"], skill["part_claim_ids"]) for skill in output["skills"]
    ] == [
        ("Free-body diagrams", ["P1:s1"]),
        ("Draw a free-body diagram", ["P2:s1"]),
    ]
    assert [item["part_claim_ids"] for item in output["assumed_knowledge"]] == [
        ["P1:a2"],
        ["P1:a1"],
        ["P2:a1"],
        ["P2:a2"],
    ]
    notes = output["extraction_notes"]
    assert "Added back concepts the merge left out: P1:c1, P2:c1" in notes
    assert "Added back skills the merge left out: P2:s1" in notes
    assert (
        "Added back assumed knowledge the merge left out: P1:a1, P2:a1, P2:a2" in notes
    )


def _unit_rows(unit):
    return ClaimExtraction.objects.filter(unit=unit, level=ClaimExtraction.Level.UNIT)


def test_merge_over_budget_fails_unit(fake_llm):
    """
    A unit whose merge call is over the merge's input budget fails, so the
    run's claims wait for it, and keeps its parts
    """
    _split_budget()
    ResourceProfileConfiguration.objects.filter(
        stage=ResourceProfileConfiguration.Stage.UNIT_MERGE
    ).update(input_token_budget=10)
    unit = _build_unit()

    with pytest.raises(ClaimExtractionError, match="over the input budget of 10"):
        _generate(unit)

    assert fake_llm.call_count == 2
    assert [part.part for part in _parts(unit)] == [1, 2]
    assert not _unit_rows(unit).exists()
    # the parts are stored, so the next sweep makes no call and fails again
    with pytest.raises(ClaimExtractionError, match="over the input budget"):
        _generate(unit)
    assert fake_llm.call_count == 2


@pytest.mark.parametrize("limit", ["max_completion_tokens", "max_tokens"])
def test_merge_not_limited_by_output_limit(fake_llm, limit):
    """
    The merge's output limits don't cap its input: the merge cites part claim
    ids rather than writing their evidence out again
    """
    _split_budget()
    ResourceProfileConfiguration.objects.filter(
        stage=ResourceProfileConfiguration.Stage.UNIT_MERGE
    ).update(**{limit: 10})
    unit = _build_unit()

    extraction = _generate(unit)

    assert extraction.level == ClaimExtraction.Level.UNIT
    assert fake_llm.call_count == 3


def test_stored_merge_not_checked_against_limit(fake_llm):
    """A stored merge is reused even when the merge's limit is lowered"""
    _split_budget()
    unit = _build_unit()
    extraction = _generate(unit)
    ResourceProfileConfiguration.objects.filter(
        stage=ResourceProfileConfiguration.Stage.UNIT_MERGE
    ).update(input_token_budget=10)

    assert _generate(unit) == extraction
    assert fake_llm.call_count == 3


def test_failed_merge_fails_unit(fake_llm):
    """
    A merge with no valid response fails the unit, which keeps its parts, and
    the next sweep calls only the merge again
    """
    _split_budget()
    unit = _build_unit()
    fake_llm.side_effect = _fail_on(UnitMergeExtraction)

    with pytest.raises(ClaimExtractionError):
        _generate(unit)

    assert fake_llm.call_count == 3
    assert [part.part for part in _parts(unit)] == [1, 2]
    assert not _unit_rows(unit).exists()

    fake_llm.side_effect = _answer
    extraction = _generate(unit)

    assert fake_llm.call_count == 4
    assert extraction.raw_response == "merge raw"


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


def test_identical_split_unit_in_other_run_reuses_extraction(fake_llm):
    """Another run's unit with the same files takes over the parts and merge"""
    _split_budget()
    unit = _build_unit()
    extraction = _generate(unit)
    other_run = LearningResourceRunFactory.create(
        learning_resource=unit.run.learning_resource
    )
    other_unit = _build_unit(other_run)

    reused = _generate(other_unit)

    assert reused.pk == extraction.pk
    assert reused.unit == other_unit
    assert [part.part for part in _parts(other_unit)] == [1, 2]
    assert fake_llm.call_count == 3


def test_split_units_with_same_part_share_it(fake_llm):
    """Units of a course with the same title and parts share the parts' rows"""
    _split_budget()
    unit = _build_unit(kind=Unit.Kind.BIN)
    other_unit = UnitFactory.create(
        run=unit.run, external_id="bin:other", title=unit.title, kind=unit.kind
    )
    for unit_file in unit.unitcontentfile_set.all():
        UnitContentFileFactory.create(
            unit=other_unit,
            content_file=unit_file.content_file,
            position=unit_file.position,
        )
    _add_file(other_unit, "Recitation: two blocks joined by a string.", position=2)

    _generate(unit)
    _generate(other_unit)
    # only the other unit's third part and its merge are new
    assert fake_llm.call_count == 5
    _generate(unit)

    assert fake_llm.call_count == 5
    # the shared rows are pointed at the unit that used them last
    assert [part.part for part in _parts(unit)] == [1, 2]
    assert [part.part for part in _parts(other_unit)] == [3]


def test_unsplit_unit_keeps_parts_another_unit_cites(fake_llm):
    """
    A unit no longer split keeps a part it shares with another unit whose
    merge cites it, so the other unit needn't extract it again
    """
    _split_budget()
    unit = _build_unit(kind=Unit.Kind.BIN)
    other_unit = UnitFactory.create(
        run=unit.run, external_id="bin:other", title=unit.title, kind=unit.kind
    )
    UnitContentFileFactory.create(
        unit=other_unit,
        content_file=unit.unitcontentfile_set.get(position=0).content_file,
        position=0,
    )
    _add_file(other_unit, "Recitation: two blocks joined by a string.", position=1)
    other_extraction = _generate(other_unit)
    _generate(unit)
    # the shared first part is pointed at the unit, which used it last
    shared = _parts(unit)[0]
    assert other_extraction.output["part_keys"][0] == shared.key
    calls = fake_llm.call_count

    unit.unitcontentfile_set.get(position=1).delete()
    extraction = _generate(unit)

    assert extraction.raw_response == "unit raw"
    # the unit's own second part is deleted, and the shared one kept
    assert _parts(unit) == [shared]
    assert _generate(other_unit) == other_extraction
    assert fake_llm.call_count == calls + 1
    assert [part.part for part in _parts(other_unit)] == [1, 2]


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


def _fail_on(schema=None, *, whole_unit=False, error=ClaimExtractionError):
    """Answer like _answer, but fail the merge call or the whole-unit call"""

    def answer(extractor, prompt):
        if extractor.schema is schema or (whole_unit and "PART " not in prompt):
            msg = "bad response"
            raise error(msg)
        return _answer(extractor, prompt)

    return answer


def _part_rows(unit):
    return {part.id: (part.part, part.key, part.output) for part in _parts(unit)}


@pytest.mark.parametrize("failing", ["part", "merge"])
def test_failed_split_keeps_parts_its_merge_cites(fake_llm, failing):
    """
    The parts the unit's merge cites are kept as they were until a new merge
    is stored, even when a removed file gives the parts after it new keys
    """
    _split_budget()
    unit = _build_unit()
    _add_file(unit, "Recitation: two blocks joined by a string.", position=2)
    first = _generate(unit)
    cited = _part_rows(unit)
    assert first.output["part_keys"] == [key for _, key, _ in cited.values()]
    # the recitation moves up to part 2, under a new key
    unit.unitcontentfile_set.get(position=1).delete()

    def answer(extractor, prompt):
        # a call that fails, like one that times out
        if (
            extractor.schema is UnitMergeExtraction
            if failing == "merge"
            else "PART 2 " in prompt
        ):
            raise TimeoutError
        return _answer(extractor, prompt)

    fake_llm.side_effect = answer

    with pytest.raises(TimeoutError):
        _generate(unit)

    rows = _part_rows(unit)
    assert {part_id: rows[part_id] for part_id in cited} == cited
    merge = ClaimExtraction.objects.get(unit=unit, level=ClaimExtraction.Level.UNIT)
    assert (merge.pk, merge.output) == (first.pk, first.output)

    fake_llm.side_effect = _answer
    extraction = _generate(unit)

    parts = _parts(unit)
    assert [part.part for part in parts] == [1, 2]
    assert extraction.output["part_keys"] == [part.key for part in parts]
    assert parts[0].pk in cited
    assert parts[1].pk not in cited


def test_failed_unsplit_call_keeps_parts(fake_llm):
    """A unit no longer split keeps its parts until its own call succeeds"""
    _split_budget()
    unit = _build_unit()
    first = _generate(unit)
    _split_budget(100000)
    fake_llm.side_effect = _fail_on(whole_unit=True)

    with pytest.raises(ClaimExtractionError):
        _generate(unit)

    assert [part.part for part in _parts(unit)] == [1, 2]
    assert ClaimExtraction.objects.get(unit=unit, level=ClaimExtraction.Level.UNIT) == (
        first
    )


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
