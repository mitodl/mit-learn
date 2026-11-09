"""
Step 2 of resource profile generation: claims about a run as a whole.

The run's context unit and each of its units have been extracted in step 1.
This step reads only those stored claims, never file text. It is implemented
only for runs without bins so far: every unit is treated as an ordered step.

The model's output is checked in code before it is stored: cited ids that
aren't in the input are dropped. The model says which concept claims teach
each preparation item before it is first needed and which teach it later; code
keeps only the ones that are taught or reviewed concepts and drops the items
taught before first use.

A run's claims are stored in ClaimExtraction under a key built from its
course and the keys and outputs of the extractions it reads, so they are
regenerated only when one of those changes.
"""

import logging
from dataclasses import dataclass

from learning_resources.models import (
    ClaimExtraction,
    LearningResourceRun,
    ResourceProfileConfiguration,
    Unit,
)
from learning_resources.profiles import prompts
from learning_resources.profiles.claims import (
    ClaimExtractor,
    get_or_create_extraction,
    load_extractor,
)
from learning_resources.profiles.schemas import RunExtraction
from learning_resources.profiles.unit_claims import CLAIM_PREFIXES

log = logging.getLogger(__name__)

# the kind each claim has in the prompt, and its heading, by claim id prefix
_KINDS_BY_PREFIX = {
    "c": ("concept", "Concepts"),
    "s": ("skill", "Skills"),
    "a": ("assumed", "Assumed knowledge"),
    "t": ("assessment", "Assessment expectations"),
}
# claim lists in a unit output: their kind and heading. Built from the unit
# step's lists, so a list added there without a kind here fails at import.
CLAIM_KINDS = {
    field: _KINDS_BY_PREFIX[prefix] for field, prefix in CLAIM_PREFIXES.items()
}
TEACHING_STATUSES = {"taught", "reviewed"}
# a coverage limitation may cite this when no claim fits
CONTEXT_NOTES_ID = "ctx:notes"


@dataclass(frozen=True)
class UnitRecord:
    """A unit of the run, as the run prompt refers to it"""

    # U01, U02, ... in course order
    display_id: str
    unit: Unit
    # None when the unit was skipped: it has no text
    extraction: ClaimExtraction | None
    # 1, 2, ... in course order
    order: int

    @property
    def claims(self) -> list[tuple[str, str, dict]]:
        """The unit's claims, as (claim id, kind, claim)"""
        if self.extraction is None:
            return []
        return [
            (f"{self.display_id}:{claim['id']}", kind, claim)
            for field, (kind, _) in CLAIM_KINDS.items()
            for claim in self.extraction.output.get(field, [])
        ]


def load_run_extractor() -> ClaimExtractor:
    """Build the run extractor from its ResourceProfileConfiguration"""
    return load_extractor(
        ResourceProfileConfiguration.Stage.RUN,
        RunExtraction,
        ClaimExtraction.Level.RUN,
    )


# --------------------------------------------------------------------------- inputs
def _display_id(order: int) -> str:
    """Return the id the run prompt gives the unit at this position"""
    return f"U{order:02d}"


def unit_records(
    unit_extractions: list[tuple[Unit, ClaimExtraction | None]],
) -> list[UnitRecord]:
    """Return a run's units in course order, with their ids"""
    # the order generate_claims_for_resource extracts them in
    units = sorted(
        unit_extractions,
        key=lambda pair: (
            pair[0].position is None,
            pair[0].position,
            pair[0].external_id,
        ),
    )
    return [
        UnitRecord(_display_id(index), unit, extraction, index)
        for index, (unit, extraction) in enumerate(units, 1)
    ]


def _claims_by_id(records: list[UnitRecord]) -> dict[str, tuple[str, dict]]:
    """Return each unit claim, as claim id: (kind, claim)"""
    return {
        claim_id: (kind, claim)
        for record in records
        for claim_id, kind, claim in record.claims
    }


def _is_taught_concept(kind: str, claim: dict) -> bool:
    """Return whether a claim is a concept the course teaches or reviews"""
    return kind == "concept" and claim.get("teaching_status") in TEACHING_STATUSES


def context_claims_by_id(output: dict | None) -> dict[str, str]:
    """Give the context extraction's claims ids, as the run prompt cites them"""
    if not output:
        return {}
    claims = {}
    for index, statement in enumerate(output.get("stated_audience", [])):
        claims[f"ctx:aud:{index}"] = statement["text"]
    if output.get("description"):
        claims["ctx:desc"] = output["description"]["text"]
    for index, statement in enumerate(output.get("objectives", [])):
        claims[f"ctx:obj:{index}"] = statement["text"]
    for index, prerequisite in enumerate(output.get("prerequisites", [])):
        claims[f"ctx:prereq:{index}"] = (
            f"[{prerequisite['kind']}] {prerequisite['statement']}"
        )
    for index, statement in enumerate(output.get("required_materials", [])):
        claims[f"ctx:req:{index}"] = statement["text"]
    return claims


def _context_block(output: dict | None) -> str:
    claims_by_id = context_claims_by_id(output)
    lines = [f"- [{claim_id}] {text}" for claim_id, text in claims_by_id.items()]
    if output:
        lines.insert(0, f"Prerequisites status: {output['prerequisites_status']}")
        outline = "; ".join(
            f"{entry['unit_label']} {entry['title']}"
            for entry in output.get("instructional_outline", [])
        )
        if outline:
            lines.append(f"Outline: {outline}")
    return "\n".join(lines) or "No course context was extracted."


def _claim_line(claim_id: str, kind: str, claim: dict) -> str:
    status = claim.get("teaching_status")
    line = f"- [{claim_id}]{f' [{status}]' if status else ''} {claim['label']}:"
    line += f" {claim['description'][:200]}"
    if kind == "assumed":
        evidence = claim.get("evidence") or [{}]
        line += (
            f" | used: {claim['how_used'][:120]}"
            f" | flagged_as_prior={claim['flagged_as_prior']}"
            f" | quote: “{(evidence[0].get('passage') or '')[:140]}”"
        )
    if kind == "assessment":
        line += " | tests: " + ", ".join(claim.get("tests_concept_labels", [])[:6])
    return line


def _units_block(records: list[UnitRecord]) -> str:
    lines = []
    for record in records:
        header = f"## {record.display_id} {record.unit.title} (unit {record.order})"
        if record.extraction is None:
            lines.append(f"{header}: NOT PROCESSED (no text)")
            continue
        lines.append(f"{header}\nSummary: {record.extraction.output['summary']}")
        claims = record.claims
        for kind, heading in CLAIM_KINDS.values():
            items = [line for line in claims if line[1] == kind]
            if items:
                lines.append(f"{heading}:")
                lines.extend(_claim_line(*item) for item in items)
        notes = record.extraction.output.get("extraction_notes")
        if notes:
            lines.append("Notes: " + " | ".join(notes))
    return "\n".join(lines)


def _run_key(
    extractor: ClaimExtractor,
    run: LearningResourceRun,
    context: ClaimExtraction | None,
    records: list[UnitRecord],
) -> str:
    def extraction_key(extraction):
        # An extraction regenerated with overwrite keeps its key but not its
        # output, and the run's claims cite the output's claim ids.
        return [extraction.key, extraction.output]

    def record_key(record):
        # a skipped unit is in the prompt by title
        if record.extraction is None:
            return ["skipped", record.unit.title]
        return extraction_key(record.extraction)

    # The course is in the key so that runs of one course share a row, like
    # the unit keys.
    return extractor.key(
        run.learning_resource_id,
        [record_key(record) for record in records],
        extraction_key(context) if context else None,
    )


# --------------------------------------------------------------------------- checks
def split_inferred_preparation(
    preparation: list[dict], records: list[UnitRecord]
) -> tuple[list[dict], list[dict]]:
    """
    Split inferred preparation into what's kept and what the course teaches.

    The model names the concept claims that teach or review each item at or
    before its first use, and the ones that do later;
    drop_unsupported_citations has already kept only the ones that are taught
    or reviewed concepts. An item
    taught before first use is dropped; one taught only later is kept with a
    review note. The reported first-needed unit is the earliest of the unit
    the model names and the units whose assumed claims it cites.

    Returns:
        tuple of (list, list): the kept items, and the dropped ones with their
            exclusion_reason
    """
    order_of = {record.display_id: record.order for record in records}
    kept, excluded = [], []
    for candidate in preparation:
        item = dict(candidate)
        # the model's unit can come after a cited first use. Context and
        # unknown ids have no order.
        orders = [
            order_of.get(claim_id.split(":")[0])
            for claim_id in item["assumed_claim_ids"]
        ]
        orders.append(order_of.get(item.get("first_needed_unit_id")))
        first = min(filter(None, orders), default=None)
        item["first_needed_unit_id"] = _display_id(first) if first else None
        teaching = list(
            dict.fromkeys(
                item.get("taught_before_first_use_claim_ids", [])
                + item.get("taught_after_first_use_claim_ids", [])
            )
        )
        before = [
            claim_id
            for claim_id in teaching
            if first is not None and order_of[claim_id.split(":")[0]] <= first
        ]
        later = [
            claim_id
            for claim_id in teaching
            if first is not None and order_of[claim_id.split(":")[0]] > first
        ]
        item["taught_before_first_use_claim_ids"] = before
        item["taught_after_first_use_claim_ids"] = later
        if before:
            item["exclusion_reason"] = (
                "taught or reviewed in the course at or before first use: "
                + ", ".join(before)
            )
            excluded.append(item)
            continue
        if later:
            item["review_note"] = (
                "the course teaches it after first use ("
                + ", ".join(later)
                + "), so this may be a sequencing gap rather than a prerequisite"
            )
        kept.append(item)
    return kept, excluded


def _drop_ungrounded_outcomes(output: dict, claims_by_id: dict) -> list[str]:
    """Drop learning outcomes that cite no skill and no taught or reviewed concept"""

    def grounds(claim_id):
        kind, claim = claims_by_id.get(claim_id, (None, {}))
        return kind == "skill" or _is_taught_concept(kind, claim)

    grounded, notes = [], []
    for item in output["learning_outcomes"]:
        if any(grounds(claim_id) for claim_id in item["claim_ids"]):
            grounded.append(item)
        else:
            notes.append(
                f"Dropped learning outcome {item['text'][:80]!r}: it cites no skill"
                " or taught concept"
            )
    output["learning_outcomes"] = grounded
    return notes


def drop_unsupported_citations(
    output: dict,
    claims_by_id: dict[str, tuple[str, dict]],
    unit_ids: set[str],
    context: dict | None,
) -> list[str]:
    """
    Remove cited ids that aren't in the input, and what is left unsupported.

    Learning outcomes must also cite a skill, or a taught or reviewed concept:
    one supported only by assessments or assumed knowledge is dropped. The
    teaching a preparation item cites keeps only taught or reviewed concepts.

    Args:
        output (dict): the model's output, changed in place
        claims_by_id (dict): the run's unit claims, see _claims_by_id
        unit_ids (set of str): the run's unit display ids
        context (dict | None): the context extraction's output

    Returns:
        list of str: a note for each id and item that was removed
    """
    known_ids = set(claims_by_id) | set(context_claims_by_id(context))
    teaching_ids = {
        claim_id for claim_id, pair in claims_by_id.items() if _is_taught_concept(*pair)
    }
    # ids of the input; one cited where it isn't valid is dropped without
    # being reported as unknown
    input_ids = known_ids | unit_ids
    unknown: set[str] = set()
    notes = []

    def keep_valid(ids: list[str], valid: set[str]) -> list[str]:
        unknown.update(i for i in ids if i not in valid and i not in input_ids)
        return [claim_id for claim_id in ids if claim_id in valid]

    def filter_items(items: list[dict], item_name: str, required: str, **fields):
        """Filter each item's id fields; keep the items with required ids left"""
        kept = []
        for item in items:
            for field, valid in fields.items():
                item[field] = keep_valid(item[field], valid)
            if item[required]:
                kept.append(item)
            else:
                name = item.get("text") or item["label"]
                notes.append(f"Dropped {item_name} {name[:80]!r}: no known claim")
        return kept

    output["summary_claim_ids"] = keep_valid(output["summary_claim_ids"], known_ids)
    # the summary is kept, since the profile needs one, but nothing backs it
    if not output["summary_claim_ids"]:
        notes.append("Summary cites no known claim")
    for field in ("audience", "learning_outcomes", "coverage_limitations"):
        # ctx:notes is offered only for limitations no claim fits
        valid_ids = (
            known_ids | unit_ids | {CONTEXT_NOTES_ID}
            if field == "coverage_limitations"
            else known_ids
        )
        output[field] = filter_items(
            output[field], field, "claim_ids", claim_ids=valid_ids
        )
    notes += _drop_ungrounded_outcomes(output, claims_by_id)
    output["main_topics"] = filter_items(
        output["main_topics"],
        "main topic",
        "concept_claim_ids",
        concept_claim_ids=teaching_ids,
        unit_ids=unit_ids,
    )
    output["inferred_preparation"] = filter_items(
        output["inferred_preparation"],
        "inferred preparation",
        "assumed_claim_ids",
        assumed_claim_ids={
            claim_id
            for claim_id, (kind, _) in claims_by_id.items()
            if kind == "assumed"
        },
        taught_before_first_use_claim_ids=teaching_ids,
        taught_after_first_use_claim_ids=teaching_ids,
    )

    if unknown:
        notes.insert(0, "Dropped unknown ids: " + ", ".join(sorted(unknown)))
    return notes


# --------------------------------------------------------------------------- output
def _check_and_complete_output(
    output: dict,
    records: list[UnitRecord],
    context_output: dict | None,
    references: dict,
) -> dict:
    """Check the model's output and add what the code derives"""
    claims_by_id = _claims_by_id(records)
    unit_ids = {record.display_id for record in records}
    output["extraction_notes"] += drop_unsupported_citations(
        output, claims_by_id, unit_ids, context_output
    )
    kept, excluded = split_inferred_preparation(output["inferred_preparation"], records)
    output["inferred_preparation"] = kept
    output["excluded_inferred_preparation"] = excluded
    truncated = sum(
        1
        for record in records
        if record.extraction
        for source in record.extraction.output.get("sources", [])
        if source.get("truncated")
    )
    if truncated:
        output["coverage_limitations"].append(
            {
                "text": (
                    f"Files over the per-file limit, read only in part: {truncated}."
                ),
                "claim_ids": [],
                "from_code": True,
            }
        )
    output["declared_prerequisites"] = {
        "status": context_output["prerequisites_status"] if context_output else None,
        "items": [
            {"claim_id": f"ctx:prereq:{index}", **prerequisite}
            for index, prerequisite in enumerate(
                (context_output or {}).get("prerequisites", [])
            )
        ],
    }
    output["concepts"] = [
        {
            "claim_id": claim_id,
            "unit_id": claim_id.split(":")[0],
            "label": claim["label"],
            "kind": claim.get("kind"),
            "teaching_status": claim["teaching_status"],
        }
        for claim_id, (kind, claim) in claims_by_id.items()
        if _is_taught_concept(kind, claim)
    ]
    output.update(references)
    return output


def _run_references(records: list[UnitRecord], context_id: int | None) -> dict:
    """
    Return what each display id refers to in this run, to resolve citations
    in step 3.

    These are rows of the run, not inputs to the model, so they are left out
    of the key: runs of a course with the same content share a row.
    """
    return {
        "units": [
            {
                "unit_id": record.display_id,
                "unit": record.unit.id,
                "extraction": record.extraction.id if record.extraction else None,
                "title": record.unit.title,
                "kind": record.unit.kind,
            }
            for record in records
        ],
        "context_extraction": context_id,
    }


def _refresh_references(extraction: ClaimExtraction, references: dict) -> None:
    """
    Point a stored run extraction at this run's rows.

    A row stored for another run of the course, such as the previous best run,
    still names that run's units, and the model isn't called again to fix it.
    """
    if all(
        extraction.output.get(field) == value for field, value in references.items()
    ):
        return
    extraction.output = {**extraction.output, **references}
    extraction.save(update_fields=["output", "updated_on"])


def generate_run_claims(
    run: LearningResourceRun,
    context: ClaimExtraction | None,
    unit_extractions: list[tuple[Unit, ClaimExtraction | None]],
    *,
    overwrite: bool = False,
) -> ClaimExtraction | None:
    """
    Generate the claims about a run from its context and unit extractions,
    or return the stored ones.

    Args:
        run (LearningResourceRun): the run
        context (ClaimExtraction | None): the context unit's extraction
        unit_extractions (list): each unit of the run, with its current
            extraction, or None when it was skipped
        overwrite (bool): call the model even when an extraction with the
            same key is stored, and replace it

    Returns:
        ClaimExtraction | None: the run's extraction, or None when none of
            its units has claims

    Raises:
        ClaimExtractionError: when the model gives no valid response
    """
    if any(unit.kind == Unit.Kind.BIN for unit, _ in unit_extractions):
        log.info("Run claims for runs with bins are not supported: %s", run.run_id)
        return None
    records = unit_records(unit_extractions)
    if not any(record.extraction for record in records):
        log.info("No unit claims to generate run claims from for %s", run.run_id)
        return None
    context_output = context.output if context else None
    references = _run_references(records, context.id if context else None)
    extractor = load_run_extractor()
    extraction = get_or_create_extraction(
        extractor,
        _run_key(extractor, run, context, records),
        lambda: prompts.run_combined_prompt(
            _context_block(context_output), _units_block(records)
        ),
        [],
        run=run,
        finish=lambda output: _check_and_complete_output(
            output, records, context_output, references
        ),
        overwrite=overwrite,
    )
    _refresh_references(extraction, references)
    return extraction
