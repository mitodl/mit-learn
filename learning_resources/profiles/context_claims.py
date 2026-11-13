"""
Step 1 of resource profile generation: claims for a run's context unit.

The context unit holds content about the course as a whole, like the
syllabus. Its claims are kept apart from the units' claims: unit prompts are
given an outline built from the run's units, not these claims, so the context
and the units can be extracted in any order.

A context unit whose files are over the input budget is split the way a unit
is: its files are packed into parts that each fit, each part is extracted on
its own and stored at the unit_part level, and a merge call combines the
parts' items into the context unit's. The merge call decides which part items
are the same and which statements conflict, within a part or between parts;
merged items cite the part items they come from, code carries their evidence
over and adds back a part item the merge leaves out, so the stored output has
the same form whether the context unit was split or not. As for a unit,
there is no fallback: a merge call over its token limit is logged as an error
and the context unit is skipped, one with no valid response fails it, and a
context unit that would need more parts than max_parts is skipped.
"""

from learning_resources.models import (
    ClaimExtraction,
    LearningResourceRun,
    ResourceProfileConfiguration,
    Unit,
)
from learning_resources.profiles import prompts
from learning_resources.profiles.claims import (
    ClaimExtractor,
    cited_part_claim_ids,
    delete_stale_parts,
    extract_split_unit,
    get_or_create_extraction,
    load_extractor,
    merge_evidence,
    merge_parts,
    part_claim_as_merged,
    part_header,
    too_many_parts,
    truncation_notes,
)
from learning_resources.profiles.schemas import (
    ContextMergeExtraction,
    CourseContextOut,
)
from learning_resources.profiles.sources import Source, pack_parts, unit_sources

# strongest first: prerequisites stated in any part are stated
PREREQUISITES_STATUS_ORDER = ["stated", "explicitly_none", "not_found"]
# the item lists of a context output, with the description as a list of at
# most one, and the prefix of their part item ids and their heading in the
# merge prompt
CONTEXT_LISTS = {
    "stated_audience": ("aud", "Stated audience"),
    "description": ("desc", "Description"),
    "objectives": ("obj", "Objectives"),
    "prerequisites": ("pre", "Prerequisites"),
    "required_materials": ("req", "Required materials"),
    "instructional_outline": ("out", "Instructional outline"),
}
# a statement of a part's conflict: P1:cs2 is the part's second, counting
# through its conflicts in order
CONFLICT_STATEMENTS = "conflict_statements"
# what a merged conflict's statements may cite: a part statement of any list
STATEMENT_KINDS = {
    "stated_audience",
    "description",
    "objectives",
    "prerequisites",
    "required_materials",
    CONFLICT_STATEMENTS,
}


def load_context_extractor() -> ClaimExtractor:
    """Build the context extractor from its ResourceProfileConfiguration"""
    return load_extractor(ResourceProfileConfiguration.Stage.CONTEXT, CourseContextOut)


def load_context_merge_extractor() -> ClaimExtractor:
    """Build the extractor that merges a split context unit's parts"""
    return load_extractor(
        ResourceProfileConfiguration.Stage.CONTEXT_MERGE, ContextMergeExtraction
    )


def _context_sources(
    run: LearningResourceRun, extractor: ClaimExtractor
) -> tuple[Unit | None, list[Source]]:
    """Return a run's context unit and its sources"""
    unit = run.units.filter(kind=Unit.Kind.CONTEXT).first()
    if not unit:
        return None, []
    config = extractor.config
    # a file is cut to fit the budget, so a split context unit's every part fits it
    return unit, unit_sources(unit, config.max_file_tokens, config.input_token_budget)


def _context_key_inputs(run: LearningResourceRun) -> list:
    # the title is in the prompt, and the output repeats it. The course is in
    # the key so that runs of one course share a row, but another course with
    # the same title and files doesn't take it over.
    return [run.learning_resource_id, run.learning_resource.title]


def _part_header(index: int, sources: list[Source]) -> str:
    return part_header(
        index,
        sources,
        "the course context",
        "The context files are too long to read at once, so the other parts are"
        " extracted separately and merged afterwards. Extract only from these"
        " sources, and set prerequisites_status from them alone.",
    )


# --------------------------------------------------------------------------- merge
def _items(output: dict, field: str) -> list[dict]:
    """Return a context output's items of one list, the description as a list"""
    if field == "description":
        return [output["description"]] if output.get("description") else []
    return output.get(field, [])


def _part_conflicts(part_index: int, output: dict) -> list[tuple[list[str], dict]]:
    """Return a part's conflicts, each with its statements' part item ids"""
    conflicts, number = [], 0
    for conflict in output.get("conflicts", []):
        count = len(conflict["statements"])
        ids = [f"P{part_index}:cs{number + offset}" for offset in range(1, count + 1)]
        conflicts.append((ids, conflict))
        number += count
    return conflicts


def _part_items_by_id(
    part_extractions: list[ClaimExtraction],
) -> dict[str, tuple[str, dict]]:
    """Return each part item, as part item id (P2:obj1): (list, item)"""
    items = {}
    for index, part in enumerate(part_extractions, 1):
        for field, (prefix, _) in CONTEXT_LISTS.items():
            for number, item in enumerate(_items(part.output, field), 1):
                items[f"P{index}:{prefix}{number}"] = (field, item)
        for ids, conflict in _part_conflicts(index, part.output):
            for item_id, statement in zip(ids, conflict["statements"], strict=True):
                items[item_id] = (CONFLICT_STATEMENTS, statement)
    return items


def _item_text(field: str, item: dict) -> str:
    if field == "prerequisites":
        course = f" (course {item['course_ref']})" if item.get("course_ref") else ""
        return f"[{item['kind']}] {item['label']}{course}: {item['statement']}"
    if field == "instructional_outline":
        return f"{item['unit_label']}: {item['title']}"
    return item["text"]


def _parts_block(
    part_extractions: list[ClaimExtraction], sources_by_part: list[list[Source]]
) -> str:
    """
    Render the parts' records for the merge prompt.

    Truncation notes are left out: code adds them to the merged output from
    the context unit's sources, so the model needn't carry them over.
    """
    lines = []
    for index, (part, sources) in enumerate(
        zip(part_extractions, sources_by_part, strict=True), 1
    ):
        output = part.output
        lines.append(
            f"## Part {index} of {len(part_extractions)} (sources"
            f" {sources[0].source_id}-{sources[-1].source_id})\n"
            f"Title: {output['title']}\n"
            f"Prerequisites status: {output['prerequisites_status']}"
        )
        for field, (prefix, heading) in CONTEXT_LISTS.items():
            items = _items(output, field)
            if items:
                lines.append(f"{heading}:")
                lines.extend(
                    f"- [P{index}:{prefix}{number}] {_item_text(field, item)}"
                    for number, item in enumerate(items, 1)
                )
        conflicts = _part_conflicts(index, output)
        if conflicts:
            lines.append("Conflicts:")
        for ids, conflict in conflicts:
            statements = " | ".join(
                f"[{item_id}] {statement['text']}"
                for item_id, statement in zip(ids, conflict["statements"], strict=True)
            )
            lines.append(
                f"- {conflict['topic']}: {statements} | assessment:"
                f" {conflict['assessment']}"
            )
        truncation = set(truncation_notes(sources))
        notes = [
            note
            for note in output.get("extraction_notes", [])
            if note not in truncation
        ]
        if notes:
            lines.append("Notes: " + " | ".join(notes))
    return "\n".join(lines)


def _resolve_item(
    item: dict, field: str, part_items: dict[str, tuple[str, dict]], kinds: set[str]
) -> dict | None:
    """
    Return a merged item with the part items it cites that exist and are of
    one of `kinds`, and their evidence, or None when it cites none
    """
    cited = cited_part_claim_ids(item["part_claim_ids"], part_items, kinds)
    if not cited:
        return None
    resolved = {**item, "part_claim_ids": cited}
    if field != "instructional_outline":
        resolved["evidence"] = merge_evidence([part_items[c][1] for c in cited])
    return resolved


def _resolve_conflicts(
    output: dict,
    part_extractions: list[ClaimExtraction],
    part_items: dict[str, tuple[str, dict]],
    notes: list[str],
) -> list[dict]:
    """
    Return the merged conflicts, each statement with the part statements it
    cites, and the parts' conflicts that none of them cites
    """
    conflicts = []
    for conflict in output["conflicts"]:
        statements = [
            resolved
            for statement in conflict["statements"]
            if (
                resolved := _resolve_item(
                    statement, "conflicts", part_items, STATEMENT_KINDS
                )
            )
        ]
        if len(statements) < 2:  # noqa: PLR2004
            notes.append(
                f"Dropped merged conflict {conflict['topic'][:80]!r}: fewer than"
                " two of its statements cite part statements"
            )
            continue
        conflicts.append({**conflict, "statements": statements})
    cited = {
        item_id
        for conflict in conflicts
        for statement in conflict["statements"]
        for item_id in statement["part_claim_ids"]
    }
    added = []
    for index, part in enumerate(part_extractions, 1):
        for ids, conflict in _part_conflicts(index, part.output):
            if cited.isdisjoint(ids):
                statements = zip(ids, conflict["statements"], strict=True)
                conflicts.append(
                    {
                        **conflict,
                        "statements": [
                            part_claim_as_merged(*item) for item in statements
                        ],
                    }
                )
                added.append(ids[0])
    if added:
        notes.append(
            "Added back conflicts the merge left out, with their first statements: "
            + ", ".join(added)
        )
    return conflicts


def resolve_context_merge(
    output: dict, part_extractions: list[ClaimExtraction]
) -> dict:
    """
    Turn a context merge output's part item citations into evidence, and
    check it.

    The merge model decides which part items are the same and which
    statements conflict; code checks only the ids it cites. Each merged item
    keeps only the part items of its own list that exist, and a conflict's
    statements the part statements of any list, and an item that cites none
    is dropped, as is a conflict left with fewer than two statements. A part
    item that no merged item cites is added back as an item of its own, and
    so is a part's conflict whose statements no merged conflict cites, so
    the merge can't lose what a part found; of the parts' descriptions, only
    the first is added back, when the merge gives none. Prerequisites are
    stated when any part states them.

    Args:
        output (dict): the verified merge output, changed in place
        part_extractions (list of ClaimExtraction): the context unit's
            parts, in order

    Returns:
        dict: the output, in the form of an unsplit context unit's
    """
    part_items = _part_items_by_id(part_extractions)
    notes = []
    for field, (_, heading) in CONTEXT_LISTS.items():
        kept = []
        for item in _items(output, field):
            resolved = _resolve_item(item, field, part_items, {field})
            if resolved is None:
                notes.append(
                    f"Dropped merged {heading.lower()} item"
                    f" {_item_text(field, item)[:80]!r}: it cites no part item of"
                    " its kind"
                )
            else:
                kept.append(resolved)
        cited = {item_id for item in kept for item_id in item["part_claim_ids"]}
        uncited = [
            (item_id, item)
            for item_id, (kind, item) in part_items.items()
            if kind == field and item_id not in cited
        ]
        if field == "description":
            uncited = uncited[:1] if not kept else []
        if uncited:
            kept.extend(part_claim_as_merged(*item) for item in uncited)
            notes.append(
                f"Added back {heading.lower()} the merge left out: "
                + ", ".join(item_id for item_id, _ in uncited)
            )
        output[field] = (kept[0] if kept else None) if field == "description" else kept
    output["conflicts"] = _resolve_conflicts(
        output, part_extractions, part_items, notes
    )
    outputs = [part.output for part in part_extractions]
    output["title"] = output["title"] or next(
        (part["title"] for part in outputs if part["title"]), ""
    )
    output["prerequisites_status"] = min(
        (part["prerequisites_status"] for part in outputs),
        key=PREREQUISITES_STATUS_ORDER.index,
    )
    output["extraction_notes"] += notes
    # the parts it cites, so delete_stale_parts keeps them while this row does
    output["part_keys"] = [part.key for part in part_extractions]
    return output


# --------------------------------------------------------------------------- extraction
def _generate_split_context_claims(
    run: LearningResourceRun,
    unit: Unit,
    extractor: ClaimExtractor,
    sources_by_part: list[list[Source]],
    *,
    overwrite: bool,
) -> ClaimExtraction | None:
    """Extract each part of a split context unit, then merge them"""
    title = run.learning_resource.title
    return extract_split_unit(
        extractor,
        unit,
        sources_by_part=sources_by_part,
        key_inputs=_context_key_inputs(run),
        build_part_prompt=lambda index, sources: prompts.context_unit_combined_prompt(
            title,
            "\n".join(source.block for source in sources),
            _part_header(index, sources),
        ),
        merge=lambda parts, key: merge_parts(
            load_context_merge_extractor(),
            key,
            lambda: prompts.context_merge_combined_prompt(
                title, _parts_block(parts, sources_by_part)
            ),
            [source for sources in sources_by_part for source in sources],
            unit=unit,
            finish=lambda output: resolve_context_merge(output, parts),
            overwrite=overwrite,
        ),
        overwrite=overwrite,
    )


def generate_context_claims(
    run: LearningResourceRun,
    extractor: ClaimExtractor | None = None,
    *,
    overwrite: bool = False,
) -> ClaimExtraction | None:
    """
    Extract a run's context unit, or return the stored extraction.

    A context unit whose files are over the input budget is extracted in
    parts that are then merged, unless it would need more than the
    configuration's max_parts or its merge call would be over the merge's
    token limit, when it is skipped.

    Args:
        run (LearningResourceRun): the run
        extractor (ClaimExtractor): the context extractor, loaded from its
            configuration when not given
        overwrite (bool): call the model even when an extraction with the
            same key is stored, and replace it. The key covers only the
            course, its title and the files' text, so this is how a prompt, model
            or code change is applied to stored claims.

    Returns:
        ClaimExtraction | None: the context unit's extraction, or None when the
            run has no context unit, its files have no text, it would need
            more than max_parts parts, or its merge call would be over the
            merge's token limit

    Raises:
        ClaimExtractionError: when the model gives no valid response
    """
    extractor = extractor or load_context_extractor()
    unit, sources = _context_sources(run, extractor)
    if not sources:
        return None
    sources_by_part = pack_parts(sources, extractor.config.input_token_budget)
    if too_many_parts(unit, sources_by_part, extractor.config.max_parts):
        return None
    if len(sources_by_part) > 1:
        return _generate_split_context_claims(
            run, unit, extractor, sources_by_part, overwrite=overwrite
        )
    extraction = get_or_create_extraction(
        extractor,
        extractor.key(
            *_context_key_inputs(run),
            [source.cache_input() for source in sources],
        ),
        lambda: prompts.context_unit_combined_prompt(
            run.learning_resource.title,
            "\n".join(source.block for source in sources),
        ),
        sources,
        unit=unit,
        overwrite=overwrite,
    )
    # the context unit fits in one call now, so parts from an earlier split
    # aren't current. They're kept until the extraction is stored, since a
    # failed call leaves the unit's earlier merged extraction, which cites them.
    delete_stale_parts(unit)
    return extraction
