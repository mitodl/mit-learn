"""
Step 1 of resource profile generation: claims for one unit.

A unit's files are sent to the model in one call, and its validated output is
stored in ClaimExtraction under a key built from its course, its own title and
kind, and the text of its files. A call whose key is already stored is
skipped, so a unit whose files haven't changed is never sent twice, even from
another run of the course. Another course's unit with the same title and files
has a key of its own, since units sharing a key share one row.

A unit whose files are over the input budget is split: its files are packed,
in unit order, into parts that each fit, each part is extracted on its own
and stored at the unit_part level, and a merge call combines the parts'
claims into the unit's claims. Merged claims cite the part claims they come
from, and their evidence is carried over from those claims, so the unit's
stored output has the same form whether it was split or not.
"""

import logging

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
    truncation_notes,
)
from learning_resources.profiles.schemas import UnitExtraction, UnitMergeExtraction
from learning_resources.profiles.sources import Source, pack_parts, unit_sources
from learning_resources.profiles.verification import normalize

log = logging.getLogger(__name__)

# claim lists in a unit output, and the prefix of their claim ids
CLAIM_PREFIXES = {
    "concepts": "c",
    "skills": "s",
    "assumed_knowledge": "a",
    "assessment_expectations": "t",
}
# strongest first: a concept taught in one part and used in another is taught
TEACHING_STATUS_ORDER = ["taught", "reviewed", "used", "mentioned"]
TEACHING_STATUSES = {"taught", "reviewed"}


def load_unit_extractor() -> ClaimExtractor:
    """Build the unit extractor from its ResourceProfileConfiguration"""
    return load_extractor(ResourceProfileConfiguration.Stage.UNIT, UnitExtraction)


def load_unit_part_extractor() -> ClaimExtractor:
    """Build the extractor for a part of a split unit: the unit's, at its own level"""
    return load_extractor(
        ResourceProfileConfiguration.Stage.UNIT,
        UnitExtraction,
        ClaimExtraction.Level.UNIT_PART,
    )


def load_unit_merge_extractor() -> ClaimExtractor:
    """Build the extractor that merges a split unit's parts"""
    return load_extractor(
        ResourceProfileConfiguration.Stage.UNIT_MERGE, UnitMergeExtraction
    )


# --------------------------------------------------------------------------- outputs
def _number_claims(output: dict) -> dict:
    """Give each claim in a unit output an id: c1, s1, a1, t1, ..."""
    for key, prefix in CLAIM_PREFIXES.items():
        output[key] = [
            {"id": f"{prefix}{index}", **claim}
            for index, claim in enumerate(output[key], 1)
        ]
    return output


def _course_outline(run: LearningResourceRun) -> tuple[str, list[int]]:
    """
    Return the course title and its units in order, for orientation, and the
    ids of those units.

    The outline is built from the run's units rather than from the context
    unit's claims, so a unit's prompt doesn't depend on another extraction.
    """
    units = list(
        run.units.filter(kind=Unit.Kind.UNIT)
        .order_by("position", "id")
        .values_list("id", "title")
    )
    lines = [f"Title: {run.learning_resource.title}"]
    if units:
        lines.append(
            "Units (course order): "
            + "; ".join(
                f"{index}. {title}" for index, (_, title) in enumerate(units, 1)
            )
        )
    return "\n".join(lines), [unit_id for unit_id, _ in units]


def _unit_header(unit: Unit, unit_ids: list[int]) -> str:
    line = f"title={unit.title!r} | kind={unit.kind}"
    if unit.id in unit_ids:
        # the total is left out: it would change for every unit when one is added
        line += f" | unit {unit_ids.index(unit.id) + 1}"
    lines = [line]
    if unit.kind == Unit.Kind.BIN:
        lines.append(
            "These files are not part of a course unit. They are grouped by where"
            " the course links them or by type, and their order is not meaningful."
        )
    return "\n".join(lines)


def _part_header(unit_header: str, index: int, sources: list[Source]) -> str:
    """Return the unit header for one part of a split unit"""
    return (
        f"{unit_header}\n"
        f"PART {index} of the unit: sources {sources[0].source_id}-"
        f"{sources[-1].source_id}. The unit is too long to read at once, so its"
        " other parts are extracted separately and merged afterwards. Extract only"
        " from these sources, and report assumed knowledge without deciding"
        " whether another part of the unit teaches it."
    )


# --------------------------------------------------------------------------- merge
def _part_claims(parts: list[ClaimExtraction]) -> dict[str, tuple[str, dict]]:
    """Return each part claim, as part claim id (P2:c4): (claim list, claim)"""
    return {
        f"P{index}:{claim['id']}": (field, claim)
        for index, part in enumerate(parts, 1)
        for field in CLAIM_PREFIXES
        for claim in part.output.get(field, [])
    }


def _part_claim_line(claim_id: str, field: str, claim: dict) -> str:
    line = f"- [{claim_id}]"
    if field == "concepts":
        line += f" [{claim['teaching_status']}] ({claim['kind']})"
    line += f" {claim['label']}: {claim['description']}"
    if field == "assumed_knowledge":
        line += (
            f" | used: {claim['how_used']}"
            f" | flagged_as_prior={claim['flagged_as_prior']}"
        )
    if field == "assessment_expectations":
        line += " | tests: " + ", ".join(claim.get("tests_concept_labels", []))
    return line


_HEADINGS = {
    "concepts": "Concepts",
    "skills": "Skills",
    "assumed_knowledge": "Assumed knowledge",
    "assessment_expectations": "Assessment expectations",
}


def _parts_block(parts: list[ClaimExtraction], part_sources: list[list[Source]]) -> str:
    """
    Render the parts' records for the merge prompt.

    Truncation notes are left out: code adds them to the merged output from
    the unit's sources, so the model needn't carry them over.
    """
    claims = _part_claims(parts)
    lines = []
    for index, (part, sources) in enumerate(zip(parts, part_sources, strict=True), 1):
        lines.append(
            f"## Part {index} of {len(parts)} (sources {sources[0].source_id}-"
            f"{sources[-1].source_id})\nSummary: {part.output['summary']}"
        )
        for field, heading in _HEADINGS.items():
            items = [
                _part_claim_line(claim_id, claim_field, claim)
                for claim_id, (claim_field, claim) in claims.items()
                if claim_id.startswith(f"P{index}:") and claim_field == field
            ]
            if items:
                lines.append(f"{heading}:")
                lines.extend(items)
        skip = set(truncation_notes(sources))
        notes = [
            note for note in part.output.get("extraction_notes", []) if note not in skip
        ]
        if notes:
            lines.append("Notes: " + " | ".join(notes))
    return "\n".join(lines)


def _merged_evidence(cited: list[dict]) -> list[dict]:
    """Return the cited part claims' evidence, without repeats"""
    evidence, seen = [], set()
    for claim in cited:
        for item in claim.get("evidence", []):
            marker = (item["source_id"], item["passage"])
            if marker not in seen:
                seen.add(marker)
                evidence.append(item)
    return evidence


def resolve_merged_claims(output: dict, parts: list[ClaimExtraction]) -> dict:
    """
    Turn a merge output's part claim citations into evidence, and check it.

    Each merged claim keeps only the part claims of its own list that exist,
    and is dropped when none are left. Its evidence is the cited claims'
    evidence, already verified in the part calls. A concept takes the
    strongest status any cited concept has, and an assumed item is flagged as
    prior if any cited one is. An assumed item whose label is a concept the
    unit teaches or reviews is dropped, since another part teaches it.

    Args:
        output (dict): the verified merge output, changed in place
        parts (list of ClaimExtraction): the unit's parts, in unit order

    Returns:
        dict: the output, with each claim's evidence in place
    """
    claims = _part_claims(parts)
    notes = []
    for field in CLAIM_PREFIXES:
        kept = []
        for merged in output[field]:
            ids = [
                claim_id
                for claim_id in dict.fromkeys(merged["part_claim_ids"])
                if claims.get(claim_id, (None,))[0] == field
            ]
            if not ids:
                notes.append(
                    f"Dropped merged {field} item {merged['label'][:80]!r}: it cites"
                    " no part claim of its kind"
                )
                continue
            cited = [claims[claim_id][1] for claim_id in ids]
            merged["part_claim_ids"] = ids
            merged["evidence"] = _merged_evidence(cited)
            # status and prior flag come from the cited claims only, so the
            # merge can't make a claim stronger than any part found it
            if field == "concepts":
                merged["teaching_status"] = min(
                    (claim["teaching_status"] for claim in cited),
                    key=TEACHING_STATUS_ORDER.index,
                )
                merged["content_file_ref"] = next(
                    (c["content_file_ref"] for c in cited if c.get("content_file_ref")),
                    None,
                )
            if field == "assumed_knowledge":
                merged["flagged_as_prior"] = any(
                    claim["flagged_as_prior"] for claim in cited
                )
            kept.append(merged)
        output[field] = kept
    taught = {
        normalize(concept["label"])
        for concept in output["concepts"]
        if concept["teaching_status"] in TEACHING_STATUSES
    }
    assumed = []
    for item in output["assumed_knowledge"]:
        if normalize(item["label"]) in taught:
            notes.append(
                f"Dropped assumed knowledge {item['label'][:80]!r}: the unit"
                " teaches or reviews it"
            )
        else:
            assumed.append(item)
    output["assumed_knowledge"] = assumed
    output["extraction_notes"] += notes
    return _number_claims(output)


# --------------------------------------------------------------------------- extraction
def _unit_key_inputs(unit: Unit) -> list:
    return [unit.run.learning_resource_id, unit.title, unit.kind]


def _generate_split_unit_claims(
    unit: Unit,
    part_sources: list[list[Source]],
    outline: str,
    header: str,
    *,
    overwrite: bool,
) -> ClaimExtraction:
    """
    Extract each part of a split unit, then merge them into the unit's claims.

    Source ids run through the whole unit, so a part's evidence cites the same
    ids as the unit's sources and is carried into the merge unchanged. A part
    is keyed by its sources' ids and text and the number of parts, which its
    prompt depends on; the merge is keyed by its parts' keys and outputs.
    """
    sources = [source for files in part_sources for source in files]
    part_extractor = load_unit_part_extractor()
    merge_extractor = load_unit_merge_extractor()
    parts = []
    for index, files in enumerate(part_sources, 1):
        part_header = _part_header(header, index, files)
        parts.append(
            get_or_create_extraction(
                part_extractor,
                part_extractor.key(
                    *_unit_key_inputs(unit),
                    index,
                    len(part_sources),
                    [[source.source_id, source.cache_input()] for source in files],
                ),
                lambda files=files, part_header=part_header: (
                    prompts.unit_combined_prompt(
                        outline,
                        part_header,
                        "\n".join(source.block for source in files),
                    )
                ),
                files,
                unit=unit,
                part=index,
                finish=_number_claims,
                overwrite=overwrite,
            )
        )
    # parts beyond the current count are left from a longer split
    ClaimExtraction.objects.filter(
        unit=unit, level=ClaimExtraction.Level.UNIT_PART, part__gt=len(parts)
    ).delete()
    return get_or_create_extraction(
        merge_extractor,
        merge_extractor.key(
            "merge",
            *_unit_key_inputs(unit),
            # a part regenerated with overwrite keeps its key but not its output
            [[part.key, part.output] for part in parts],
        ),
        lambda: prompts.unit_merge_combined_prompt(
            outline, header, _parts_block(parts, part_sources)
        ),
        sources,
        unit=unit,
        finish=lambda output: resolve_merged_claims(output, parts),
        overwrite=overwrite,
    )


def generate_unit_claims(
    unit: Unit,
    *,
    overwrite: bool = False,
) -> ClaimExtraction | None:
    """
    Generate the claims for one unit or bin, or return the stored ones.

    The prompt is given the course title and the run's units in order, along
    with the unit's own files. A unit whose files are over the input budget
    is extracted in parts that are then merged.

    Args:
        unit (Unit): the unit or bin
        overwrite (bool): call the model even when an extraction with the
            same key is stored, and replace it. The key covers only the
            course, the unit's title and kind and the files' text, so this is
            how a change to the prompt, model, code or course outline is
            applied to stored claims.

    Returns:
        ClaimExtraction | None: the unit's extraction, or None when the unit
            has no files with text

    Raises:
        ClaimExtractionError: when the model gives no valid response
        ValueError: for the context unit, which generate_context_claims extracts
    """
    if unit.kind == Unit.Kind.CONTEXT:
        msg = "The context unit is extracted with generate_context_claims"
        raise ValueError(msg)
    extractor = load_unit_extractor()
    config = extractor.config
    # a file is cut to fit the budget, so a split unit's every part fits it
    sources = unit_sources(unit, config.max_file_tokens, config.input_token_budget)
    if not sources:
        return None
    outline, unit_ids = _course_outline(unit.run)
    header = _unit_header(unit, unit_ids)
    part_sources = pack_parts(sources, config.input_token_budget)
    if len(part_sources) > 1:
        return _generate_split_unit_claims(
            unit, part_sources, outline, header, overwrite=overwrite
        )
    # the unit fits in one call now; parts from an earlier split aren't current
    ClaimExtraction.objects.filter(
        unit=unit, level=ClaimExtraction.Level.UNIT_PART
    ).delete()
    return get_or_create_extraction(
        extractor,
        extractor.key(
            *_unit_key_inputs(unit),
            [source.cache_input() for source in sources],
        ),
        lambda: prompts.unit_combined_prompt(
            outline,
            header,
            "\n".join(source.block for source in sources),
        ),
        sources,
        unit=unit,
        finish=_number_claims,
        overwrite=overwrite,
    )
