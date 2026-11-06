"""
Step 2 of resource profile generation: claims about a run as a whole.

The run's context unit and each of its units and bins have been extracted in
step 1. This step reads only those stored claims, never file text, so the
prompt is about the same size for a course with units as for one made only of
bins. The model's output is checked in code before it is stored: cited ids
that aren't in the input are dropped, and the inferred-preparation rule is
applied here rather than left to the model. The model says which concept claims
teach each preparation item; code checks those claims and their units' order.

A run's claims are stored in ClaimExtraction under a key built from its
course and the keys of the extractions it reads, so they are regenerated only
when one of those changes. Bin keys are sorted, so rebuilding a run's bins in
another order reuses the stored claims.
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

log = logging.getLogger(__name__)

# claim lists in a unit output, and the kind each claim has in the prompt
CLAIM_KINDS = {
    "concepts": "concept",
    "skills": "skill",
    "assumed_knowledge": "assumed",
    "assessment_expectations": "assessment",
}
TEACHING_STATUSES = {"taught", "reviewed"}
# a coverage limitation may cite this when no claim fits
NOTES_ID = "ctx:notes"


@dataclass(frozen=True)
class UnitRecord:
    """A unit or bin of the run, as the run prompt refers to it"""

    # U01, U02, ... for units in course order; B01, B02, ... for bins
    display_id: str
    unit: Unit
    # None when the unit was skipped: no text, or over the input budget
    extraction: ClaimExtraction | None
    # 1, 2, ... for units; None for bins, which have no order
    order: int | None

    @property
    def claims(self) -> list[tuple[str, str, dict]]:
        """The unit's claims, as (claim id, kind, claim)"""
        if self.extraction is None:
            return []
        return [
            (f"{self.display_id}:{claim['id']}", kind, claim)
            for field, kind in CLAIM_KINDS.items()
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
def unit_records(
    extractions: list[tuple[Unit, ClaimExtraction | None]],
) -> list[UnitRecord]:
    """
    Return a run's units in course order, then its bins, with their ids.

    Bins are numbered by the key of their extraction, so the prompt, like the
    key, doesn't depend on the order bins were built in. Skipped bins come
    last, by external id.
    """
    units = sorted(
        (pair for pair in extractions if pair[0].kind == Unit.Kind.UNIT),
        key=lambda pair: (pair[0].position is None, pair[0].position, pair[0].id),
    )
    bins = sorted(
        (pair for pair in extractions if pair[0].kind == Unit.Kind.BIN),
        key=lambda pair: (
            pair[1] is None,
            pair[1].key if pair[1] else pair[0].external_id,
        ),
    )
    return [
        UnitRecord(f"U{index:02d}", unit, extraction, index)
        for index, (unit, extraction) in enumerate(units, 1)
    ] + [
        UnitRecord(f"B{index:02d}", unit, extraction, None)
        for index, (unit, extraction) in enumerate(bins, 1)
    ]


def context_claims(output: dict | None) -> dict[str, str]:
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
    for index, conflict in enumerate(output.get("conflicts", [])):
        statements = " / ".join(item["text"] for item in conflict["statements"])
        claims[f"ctx:conflict:{index}"] = (
            f"{conflict['topic']}: {statements} ({conflict['assessment']})"
        )
    return claims


def _context_block(output: dict | None) -> str:
    claims = context_claims(output)
    lines = [f"- [{claim_id}] {text}" for claim_id, text in claims.items()]
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


def _records_block(records: list[UnitRecord]) -> str:
    titles = {
        "concept": "Concepts",
        "skill": "Skills",
        "assumed": "Assumed knowledge",
        "assessment": "Assessment expectations",
    }
    lines = []
    for record in records:
        where = f"unit {record.order}" if record.order else "bin, unordered"
        header = f"## {record.display_id} {record.unit.title} ({where})"
        if record.extraction is None:
            lines.append(f"{header}: NOT PROCESSED (no text, or over the budget)")
            continue
        lines.append(f"{header}\nSummary: {record.extraction.output['summary']}")
        claims = record.claims
        for kind, title in titles.items():
            items = [line for line in claims if line[1] == kind]
            if items:
                lines.append(f"{title}:")
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
    def record_key(record):
        # a skipped unit is in the prompt by title
        return (
            record.extraction.key
            if record.extraction
            else ["skipped", record.unit.title]
        )

    # The course is in the key so that runs of one course share a row, like
    # the unit keys. Bins are already in key order.
    return extractor.key(
        run.learning_resource_id,
        [record_key(record) for record in records if record.order],
        [record_key(record) for record in records if not record.order],
        context.key if context else None,
    )


# --------------------------------------------------------------------------- checks
def _teaching_claims(records: list[UnitRecord]) -> dict[str, int | None]:
    """Return the order of each taught or reviewed concept claim's unit"""
    return {
        claim_id: record.order
        for record in records
        for claim_id, kind, claim in record.claims
        if kind == "concept" and claim.get("teaching_status") in TEACHING_STATUSES
    }


def apply_preparation_rule(
    preparation: list[dict], records: list[UnitRecord]
) -> tuple[list[dict], list[dict]]:
    """
    Split inferred preparation into what's kept and what the course teaches.

    The model names the concept claims that teach or review each item. Only
    the ones that are taught or reviewed concepts count, and an item is
    dropped when one of them is in the unit it is first needed in or one
    before. It is first needed in the earliest of the unit the model names and
    the units whose assumed claims it cites. Bins have no order, so an item
    only bins assume is dropped when anything in the course teaches it, and
    has no first-needed unit; teaching in a bin is neither before nor after
    an item's first use in a unit.

    Returns:
        tuple of (list, list): the kept items, and the dropped ones with their
            exclusion_reason
    """
    order_of = {record.display_id: record.order for record in records}
    teaching_claims = _teaching_claims(records)
    kept, excluded = [], []
    for candidate in preparation:
        item = dict(candidate)
        # the earlier of the model's unit and the earliest unit whose claims it
        # cites: the model's unit can come after a cited first use. Bins and
        # unknown ids have no order.
        orders = [
            order_of.get(claim_id.split(":")[0])
            for claim_id in item["assumed_claim_ids"]
        ] + [order_of.get(item.get("first_needed_unit_id"))]
        first = min((order for order in orders if order), default=None)
        # bins have no order, so they are never the first unit that needs it
        item["first_needed_unit_id"] = next(
            (
                unit_id
                for unit_id, order in order_of.items()
                if first is not None and order == first
            ),
            None,
        )
        cited = [
            claim_id
            for claim_id in item.get("taught_in_claim_ids", [])
            if claim_id in teaching_claims
        ]
        if first is None:
            # only bins assume it: teaching anywhere in the course counts
            hits, later = cited, []
        else:
            hits = [
                claim_id
                for claim_id in cited
                if teaching_claims[claim_id] and teaching_claims[claim_id] <= first
            ]
            later = [
                claim_id
                for claim_id in cited
                if teaching_claims[claim_id] and teaching_claims[claim_id] > first
            ]
        item["code_check_taught_in"] = hits
        item["code_check_taught_later_in"] = later
        if hits:
            item["exclusion_reason"] = (
                "taught or reviewed in the course at or before first use: "
                + ", ".join(hits)
            )
            excluded.append(item)
        else:
            if later:
                item["review_note"] = (
                    "the course teaches it after first use ("
                    + ", ".join(later)
                    + "), so this may be a sequencing gap rather than a prerequisite"
                )
            kept.append(item)
    return kept, excluded


def _known(ids: list[str], known: set[str], unknown: set[str]) -> list[str]:
    unknown.update(claim_id for claim_id in ids if claim_id not in known)
    return [claim_id for claim_id in ids if claim_id in known]


def _drop_ungrounded_outcomes(output: dict, claims: dict) -> list[str]:
    """Drop learning outcomes that cite no skill and no taught or reviewed concept"""

    def teaches(claim_id):
        kind, claim = claims.get(claim_id, (None, {}))
        return kind == "skill" or (
            kind == "concept" and claim.get("teaching_status") in TEACHING_STATUSES
        )

    grounded, notes = [], []
    for item in output["learning_outcomes"]:
        if any(teaches(claim_id) for claim_id in item["claim_ids"]):
            grounded.append(item)
        else:
            notes.append(
                f"Dropped learning outcome {item['text'][:80]!r}: it cites no skill"
                " or taught concept"
            )
    output["learning_outcomes"] = grounded
    return notes


def drop_unknown_ids(
    output: dict, records: list[UnitRecord], context: dict | None
) -> list[str]:
    """
    Remove cited ids that aren't in the input, and what is left unsupported.

    Learning outcomes must also cite a skill, or a taught or reviewed concept:
    one supported only by assessments or assumed knowledge is dropped.

    Returns:
        list of str: a note for each id and item that was removed
    """
    claims = {
        claim_id: (kind, claim)
        for record in records
        for claim_id, kind, claim in record.claims
    }
    known = set(claims) | set(context_claims(context)) | {NOTES_ID}
    unit_ids = {record.display_id for record in records}
    unknown: set[str] = set()
    notes = []

    output["summary_claim_ids"] = _known(output["summary_claim_ids"], known, unknown)
    for field in (
        "audience",
        "learning_outcomes",
        "coverage_limitations",
        "unresolved_conflicts",
    ):
        kept = []
        for item in output[field]:
            item["claim_ids"] = _known(item["claim_ids"], known, unknown)
            if item["claim_ids"]:
                kept.append(item)
            else:
                notes.append(f"Dropped {field} {item['text'][:80]!r}: no known claim")
        output[field] = kept

    notes += _drop_ungrounded_outcomes(output, claims)

    topics = []
    for topic in output["main_topics"]:
        topic["concept_claim_ids"] = _known(topic["concept_claim_ids"], known, unknown)
        topic["unit_ids"] = _known(topic["unit_ids"], unit_ids, unknown)
        if topic["concept_claim_ids"]:
            topics.append(topic)
        else:
            notes.append(f"Dropped main topic {topic['label']!r}: no known concept")
    output["main_topics"] = topics

    preparation = []
    for item in output["inferred_preparation"]:
        item["assumed_claim_ids"] = _known(item["assumed_claim_ids"], known, unknown)
        item["taught_in_claim_ids"] = _known(
            item["taught_in_claim_ids"], known, unknown
        )
        if item.get("first_needed_unit_id") not in unit_ids:
            item["first_needed_unit_id"] = None
        if item["assumed_claim_ids"]:
            preparation.append(item)
        else:
            notes.append(
                f"Dropped inferred preparation {item['label']!r}: no known claim"
            )
    output["inferred_preparation"] = preparation

    if unknown:
        notes.insert(0, "Dropped unknown ids: " + ", ".join(sorted(unknown)))
    return notes


# --------------------------------------------------------------------------- output
def _limitations(records: list[UnitRecord]) -> list[dict]:
    """Return the limitations the code states, for bins and truncated files"""
    limitations = []

    def files(record):
        return (
            len(record.extraction.output.get("sources", [])) if record.extraction else 0
        )

    in_bins = sum(files(record) for record in records if not record.order)
    if any(not record.order for record in records):
        in_units = sum(files(record) for record in records if record.order)
        limitations.append(
            {
                "text": (
                    f"{in_units} of {in_units + in_bins} files were in ordered units;"
                    f" preparation for the {in_bins} in bins was judged course-wide."
                ),
                "claim_ids": [],
                "from_code": True,
            }
        )
    truncated = sum(
        1
        for record in records
        if record.extraction
        for source in record.extraction.output.get("sources", [])
        if source.get("truncated")
    )
    if truncated:
        limitations.append(
            {
                "text": (
                    f"Files over the per-file limit, read only in part: {truncated}."
                ),
                "claim_ids": [],
                "from_code": True,
            }
        )
    return limitations


def _finish(
    output: dict, records: list[UnitRecord], context: ClaimExtraction | None
) -> dict:
    """Check the model's output and add what the code derives"""
    context_output = context.output if context else None
    output["extraction_notes"] += drop_unknown_ids(output, records, context_output)
    kept, excluded = apply_preparation_rule(output["inferred_preparation"], records)
    output["inferred_preparation"] = kept
    output["excluded_inferred_preparation"] = excluded
    output["coverage_limitations"] += _limitations(records)
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
            "unit_id": record.display_id,
            "label": claim["label"],
            "kind": claim.get("kind"),
            "teaching_status": claim["teaching_status"],
        }
        for record in records
        for claim_id, kind, claim in record.claims
        if kind == "concept" and claim.get("teaching_status") in TEACHING_STATUSES
    ]
    # what each display id refers to, to resolve citations in step 3
    output["units"] = [
        {
            "unit_id": record.display_id,
            "unit": record.unit.id,
            "extraction": record.extraction.id if record.extraction else None,
            "title": record.unit.title,
            "kind": record.unit.kind,
        }
        for record in records
    ]
    output["context_extraction"] = context.id if context else None
    return output


def generate_run_claims(
    run: LearningResourceRun,
    context: ClaimExtraction | None,
    extractions: list[tuple[Unit, ClaimExtraction | None]],
    *,
    overwrite: bool = False,
) -> ClaimExtraction | None:
    """
    Generate the claims about a run from its context and unit extractions,
    or return the stored ones.

    Args:
        run (LearningResourceRun): the run
        context (ClaimExtraction | None): the context unit's extraction
        extractions (list): each unit and bin of the run, with its current
            extraction, or None when it was skipped
        overwrite (bool): call the model even when an extraction with the
            same key is stored, and replace it

    Returns:
        ClaimExtraction | None: the run's extraction, or None when none of
            its units or bins has claims

    Raises:
        ClaimExtractionError: when the model gives no valid response
    """
    records = unit_records(extractions)
    if not any(record.extraction for record in records):
        log.info("No unit claims to generate run claims from for %s", run.run_id)
        return None
    extractor = load_run_extractor()
    return get_or_create_extraction(
        extractor,
        _run_key(extractor, run, context, records),
        lambda: prompts.run_combined_prompt(
            _context_block(context.output if context else None),
            _records_block(records),
        ),
        [],
        run=run,
        finish=lambda output: _finish(output, records, context),
        overwrite=overwrite,
    )
