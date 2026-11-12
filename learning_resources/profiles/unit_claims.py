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
stored output has the same form whether it was split or not. A part's
concept, skill or assessment expectation that the merge leaves out is added
back. When the parts' records are too long for the merge call, or it gives no
valid response, the parts are merged in code instead, by label. A unit that
would need more parts than the configuration's max_parts is skipped, which
caps the calls one unit can cost.
"""

import logging
import re

from learning_resources.models import (
    ClaimExtraction,
    LearningResourceRun,
    ResourceProfileConfiguration,
    Unit,
)
from learning_resources.profiles import prompts
from learning_resources.profiles.claims import (
    ClaimExtractionError,
    ClaimExtractor,
    delete_stale_parts,
    extract_split_unit,
    get_or_create_extraction,
    load_extractor,
    merge_evidence,
    part_header,
    too_many_parts,
    truncation_notes,
)
from learning_resources.profiles.schemas import UnitExtraction, UnitMergeExtraction
from learning_resources.profiles.sources import (
    Source,
    estimate_tokens,
    pack_parts,
    unit_sources,
)
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
    return f"{unit_header}\n" + part_header(
        index,
        sources,
        "the unit",
        "The unit is too long to read at once, so its other parts are extracted"
        " separately and merged afterwards. Extract only from these sources, and"
        " report assumed knowledge without deciding whether another part of the"
        " unit teaches it.",
    )


# --------------------------------------------------------------------------- merge
def _part_claims_by_id(
    part_extractions: list[ClaimExtraction],
) -> dict[str, tuple[str, dict]]:
    """Return each part claim, as part claim id (P2:c4): (claim list, claim)"""
    return {
        f"P{index}:{claim['id']}": (field, claim)
        for index, part in enumerate(part_extractions, 1)
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


_CLAIM_LIST_HEADINGS = {
    "concepts": "Concepts",
    "skills": "Skills",
    "assumed_knowledge": "Assumed knowledge",
    "assessment_expectations": "Assessment expectations",
}


def _parts_block(
    part_extractions: list[ClaimExtraction], sources_by_part: list[list[Source]]
) -> str:
    """
    Render the parts' records for the merge prompt.

    Truncation notes are left out: code adds them to the merged output from
    the unit's sources, so the model needn't carry them over.
    """
    lines = []
    for index, (part, sources) in enumerate(
        zip(part_extractions, sources_by_part, strict=True), 1
    ):
        lines.append(
            f"## Part {index} of {len(part_extractions)} (sources"
            f" {sources[0].source_id}-{sources[-1].source_id})\n"
            f"Summary: {part.output['summary']}"
        )
        for field, heading in _CLAIM_LIST_HEADINGS.items():
            items = [
                _part_claim_line(f"P{index}:{claim['id']}", field, claim)
                for claim in part.output.get(field, [])
            ]
            if items:
                lines.append(f"{heading}:")
                lines.extend(items)
        truncation = set(truncation_notes(sources))
        notes = [
            note
            for note in part.output.get("extraction_notes", [])
            if note not in truncation
        ]
        if notes:
            lines.append("Notes: " + " | ".join(notes))
    return "\n".join(lines)


_PART_CLAIM_ID = re.compile(r"P(\d+):([a-z])(\d+)", re.IGNORECASE)


def _normalize_part_claim_id(claim_id: str) -> str:
    """
    Return a part claim id the merge model cites in the form P2:c4, so that
    variants of it like "p2:c4", "P2: c4" or "[P2:c4]" are found
    """
    compact = re.sub(r"[^A-Za-z0-9:]", "", claim_id)
    match = _PART_CLAIM_ID.fullmatch(compact)
    if not match:
        return compact
    part, prefix, number = match.groups()
    return f"P{int(part)}:{prefix.lower()}{int(number)}"


def _add_part_claims(
    merged_claims: list[dict], field: str, part_claims: list[tuple[str, dict]]
) -> None:
    """
    Add part claims of one claim list to its merged claims, in place.

    A part claim is cited by the merged claim with its label, compared
    normalized, or else becomes a merged claim of its own, made from its own
    fields. An assessment expectation's tested concepts are combined.

    Args:
        merged_claims (list of dict): the merged claims of the list
        field (str): the claim list, like "concepts"
        part_claims (list of tuple): (part claim id, part claim) pairs
    """
    by_label = {normalize(merged["label"]): merged for merged in merged_claims}
    for claim_id, claim in part_claims:
        label = normalize(claim["label"])
        merged = by_label.get(label)
        if merged is None:
            merged = {name: value for name, value in claim.items() if name != "id"}
            merged["part_claim_ids"] = []
            merged_claims.append(merged)
            by_label[label] = merged
        merged["part_claim_ids"].append(claim_id)
        if field == "assessment_expectations":
            merged["tests_concept_labels"] = list(
                dict.fromkeys(
                    merged.get("tests_concept_labels", [])
                    + claim.get("tests_concept_labels", [])
                )
            )


def _complete_merged_claims(
    output: dict, part_extractions: list[ClaimExtraction]
) -> dict:
    """
    Give each merged claim the evidence of the part claims it cites, then
    drop assumed knowledge the unit teaches and number the claims.

    The evidence was verified in the part calls. A concept takes the strongest
    status any cited concept has, and an assumed item is flagged as prior if
    any cited one is. An assumed item whose label is a concept the unit
    teaches or reviews is dropped, since another part teaches it.

    The output's part_keys are the keys of the parts its claims cite, in unit
    order: P2:c4 is claim c4 of the extraction with the second key. A unit
    can briefly have two rows for a part, the cited one and a newer one,
    when a new merge of it has failed.

    Args:
        output (dict): a merged output whose claims cite only part claims of
            their own list, changed in place
        part_extractions (list of ClaimExtraction): the unit's parts, in unit
            order
    """
    part_claims = _part_claims_by_id(part_extractions)
    output["part_keys"] = [part.key for part in part_extractions]
    for field in CLAIM_PREFIXES:
        for merged in output[field]:
            cited = [part_claims[claim_id][1] for claim_id in merged["part_claim_ids"]]
            merged["evidence"] = merge_evidence(cited)
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
    taught_labels = {
        normalize(concept["label"])
        for concept in output["concepts"]
        if concept["teaching_status"] in TEACHING_STATUSES
    }
    assumed = []
    for item in output["assumed_knowledge"]:
        if normalize(item["label"]) in taught_labels:
            output["extraction_notes"].append(
                f"Dropped assumed knowledge {item['label'][:80]!r}: the unit"
                " teaches or reviews it"
            )
        else:
            assumed.append(item)
    output["assumed_knowledge"] = assumed
    return _number_claims(output)


def resolve_merged_claims(
    output: dict, part_extractions: list[ClaimExtraction]
) -> dict:
    """
    Turn a merge output's part claim citations into evidence, and check it.

    Each merged claim keeps only the part claims of its own list that exist,
    and is dropped when none are left. A part's concept, skill or assessment
    expectation that no merged claim cites is added back, to the merged claim
    with its label or as a claim of its own, so the merge can't lose what a
    part found. An assumed item no merged claim cites is only noted: the merge
    is told to leave out the ones another part teaches. Each claim is then
    completed with _complete_merged_claims.

    Args:
        output (dict): the verified merge output, changed in place
        part_extractions (list of ClaimExtraction): the unit's parts, in unit
            order

    Returns:
        dict: the output, with each claim's evidence in place
    """
    part_claims = _part_claims_by_id(part_extractions)
    notes = []
    for field, heading in _CLAIM_LIST_HEADINGS.items():
        kept = []
        for merged in output[field]:
            cited_ids = [
                claim_id
                for claim_id in dict.fromkeys(
                    _normalize_part_claim_id(claim_id)
                    for claim_id in merged["part_claim_ids"]
                )
                if part_claims.get(claim_id, (None,))[0] == field
            ]
            if not cited_ids:
                notes.append(
                    f"Dropped merged {field} item {merged['label'][:80]!r}: it cites"
                    " no part claim of its kind"
                )
                continue
            merged["part_claim_ids"] = cited_ids
            kept.append(merged)
        output[field] = kept
        cited = {claim_id for merged in kept for claim_id in merged["part_claim_ids"]}
        uncited = [
            (claim_id, claim)
            for claim_id, (claim_field, claim) in part_claims.items()
            if claim_field == field and claim_id not in cited
        ]
        if not uncited:
            continue
        uncited_ids = ", ".join(claim_id for claim_id, _ in uncited)
        if field == "assumed_knowledge":
            notes.append(f"The merge left out {heading.lower()} {uncited_ids}")
        else:
            _add_part_claims(kept, field, uncited)
            notes.append(
                f"Added back {heading.lower()} the merge left out: {uncited_ids}"
            )
    output["extraction_notes"] += notes
    return _complete_merged_claims(output, part_extractions)


def merge_parts_in_code(
    part_extractions: list[ClaimExtraction], sources: list[Source], reason: str
) -> dict:
    """
    Merge a split unit's parts without the model.

    Part claims of one list with the same label, compared normalized, become
    one claim, and the summary is the parts' summaries in order. It is used
    when the merge model can't be, so it doesn't combine claims the model
    would, like a concept named two ways.

    Args:
        part_extractions (list of ClaimExtraction): the unit's parts, in unit
            order
        sources (list of Source): the unit's sources
        reason (str): why the merge is made in code, the output's first note

    Returns:
        dict: the unit's output, in the form of a merge call's resolved one
    """
    part_claims = _part_claims_by_id(part_extractions)
    part_notes = [
        note for part in part_extractions for note in part.output["extraction_notes"]
    ]
    output = {
        "summary": " ".join(part.output["summary"] for part in part_extractions),
        "extraction_notes": list(
            dict.fromkeys([reason, *part_notes, *truncation_notes(sources)])
        ),
        "sources": [source.summary() for source in sources],
    }
    for field in CLAIM_PREFIXES:
        output[field] = []
        _add_part_claims(
            output[field],
            field,
            [
                (claim_id, claim)
                for claim_id, (claim_field, claim) in part_claims.items()
                if claim_field == field
            ],
        )
    return _complete_merged_claims(output, part_extractions)


def _merge_token_limit(config: ResourceProfileConfiguration) -> int:
    """
    Return the most tokens of part records the merge model is given: its
    input budget, or its output limit when that is lower, since the merge
    writes the parts' claims out again
    """
    limits = (
        config.input_token_budget,
        config.max_completion_tokens,
        config.max_tokens,
    )
    return min(limit for limit in limits if limit is not None)


def _merge_parts(  # noqa: PLR0913
    unit: Unit,
    part_extractions: list[ClaimExtraction],
    key: str,
    *,
    sources_by_part: list[list[Source]],
    outline: str,
    header: str,
    overwrite: bool,
) -> ClaimExtraction:
    """
    Merge a split unit's parts with the merge model, or in code when their
    records are over its limit or it gives no valid response.

    A merge made in code is stored under the merge's key, like the model's,
    so it is reused until the parts change or it is overwritten, rather than
    failing the unit, and so the course's run claims, on every sweep.

    Args:
        unit (Unit): the split unit
        part_extractions (list of ClaimExtraction): the unit's parts, in unit
            order
        key (str): the merge's cache key
        sources_by_part (list of list of Source): each part's sources
        outline (str): the course outline, for the prompt
        header (str): the unit header, for the prompt
        overwrite (bool): merge even when the key is stored
    """
    extractor = load_unit_merge_extractor()
    sources = [source for part_sources in sources_by_part for source in part_sources]
    parts_block = _parts_block(part_extractions, sources_by_part)

    def merge_in_code(reason: str) -> ClaimExtraction:
        def compute():
            log.warning(
                "Merging the %d parts of unit %s in code: %s",
                len(part_extractions),
                unit.id,
                reason,
            )
            return merge_parts_in_code(part_extractions, sources, reason)

        return get_or_create_extraction(
            extractor, key, compute=compute, unit=unit, overwrite=overwrite
        )

    tokens, limit = estimate_tokens(parts_block), _merge_token_limit(extractor.config)
    if tokens > limit:
        return merge_in_code(
            f"The parts were merged in code: their records, about {tokens:,}"
            f" tokens, are over the merge's limit of {limit:,}"
        )
    try:
        return get_or_create_extraction(
            extractor,
            key,
            lambda: prompts.unit_merge_combined_prompt(outline, header, parts_block),
            sources,
            unit=unit,
            finish=lambda output: resolve_merged_claims(output, part_extractions),
            overwrite=overwrite,
        )
    except ClaimExtractionError:
        log.warning("The merge of unit %s failed", unit.id, exc_info=True)
        return merge_in_code(
            "The parts were merged in code: the merge model gave no valid response"
        )


# --------------------------------------------------------------------------- extraction
def _unit_key_inputs(unit: Unit) -> list:
    return [unit.run.learning_resource_id, unit.title, unit.kind]


def _generate_split_unit_claims(  # noqa: PLR0913
    unit: Unit,
    extractor: ClaimExtractor,
    sources_by_part: list[list[Source]],
    outline: str,
    header: str,
    *,
    overwrite: bool,
) -> ClaimExtraction:
    """
    Extract each part of a split unit, then merge them into the unit's claims.

    The parts are extracted with the unit's extractor, at the unit_part level.

    The merge is keyed by its parts' keys and outputs.
    """
    return extract_split_unit(
        extractor,
        unit,
        sources_by_part=sources_by_part,
        key_inputs=_unit_key_inputs(unit),
        build_part_prompt=lambda index, sources: prompts.unit_combined_prompt(
            outline,
            _part_header(header, index, sources),
            "\n".join(source.block for source in sources),
        ),
        merge=lambda parts, key: _merge_parts(
            unit,
            parts,
            key,
            sources_by_part=sources_by_part,
            outline=outline,
            header=header,
            overwrite=overwrite,
        ),
        finish_part=_number_claims,
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
    is extracted in parts that are then merged, unless it would need more
    than the configuration's max_parts, when it is skipped.

    Args:
        unit (Unit): the unit or bin
        overwrite (bool): call the model even when an extraction with the
            same key is stored, and replace it. The key covers only the
            course, the unit's title and kind and the files' text, so this is
            how a change to the prompt, model, code or course outline is
            applied to stored claims.

    Returns:
        ClaimExtraction | None: the unit's extraction, or None when the unit
            has no files with text or would need more than max_parts parts

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
    sources_by_part = pack_parts(sources, config.input_token_budget)
    if too_many_parts(unit, sources_by_part, config.max_parts):
        return None
    outline, unit_ids = _course_outline(unit.run)
    header = _unit_header(unit, unit_ids)
    if len(sources_by_part) > 1:
        return _generate_split_unit_claims(
            unit, extractor, sources_by_part, outline, header, overwrite=overwrite
        )
    extraction = get_or_create_extraction(
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
    # the unit fits in one call now, so parts from an earlier split aren't
    # current. They're kept until the extraction is stored, since a failed
    # call leaves the unit's earlier merge, which cites them.
    delete_stale_parts(unit)
    return extraction
