"""
Step 1 of resource profile generation: claims for a run's context unit.

The context unit holds content about the course as a whole, like the
syllabus. Its claims are kept apart from the units' claims: unit prompts are
given an outline built from the run's units, not these claims, so the context
and the units can be extracted in any order.

A context unit whose files are over the input budget is split the way a unit
is: its files are packed into parts that each fit, and each part is extracted
on its own and stored at the unit_part level. The parts' outputs are then
combined in code rather than by a merge call: context claims are statements
with their own evidence, which the run stage reads by position, so they are
concatenated, with repeats dropped.
"""

from dataclasses import replace

from learning_resources.models import (
    ClaimExtraction,
    LearningResourceRun,
    ResourceProfileConfiguration,
    Unit,
)
from learning_resources.profiles import prompts
from learning_resources.profiles.claims import (
    ClaimExtractor,
    delete_stale_parts,
    extract_parts,
    get_or_create_computed_extraction,
    get_or_create_extraction,
    load_extractor,
    merge_evidence,
)
from learning_resources.profiles.schemas import CourseContextOut
from learning_resources.profiles.sources import Source, pack_parts, unit_sources
from learning_resources.profiles.verification import normalize

# strongest first: prerequisites stated in any part are stated
PREREQUISITES_STATUS_ORDER = ["stated", "explicitly_none", "not_found"]


def load_context_extractor() -> ClaimExtractor:
    """Build the context extractor from its ResourceProfileConfiguration"""
    return load_extractor(ResourceProfileConfiguration.Stage.CONTEXT, CourseContextOut)


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
    return (
        f"PART {index} of the course context: sources {sources[0].source_id}-"
        f"{sources[-1].source_id}. The context files are too long to read at once,"
        " so the other parts are extracted separately and combined afterwards."
        " Extract only from these sources, and set prerequisites_status from"
        " them alone."
    )


# --------------------------------------------------------------------------- merge
def _dedupe_by(items: list[dict], key) -> list[dict]:
    """
    Return items in order, with an item whose key(item) repeats an earlier
    one's dropped and its evidence, if items have evidence, added to the
    earlier one's
    """
    merged: dict = {}
    for item in items:
        item_key = key(item)
        if item_key not in merged:
            merged[item_key] = dict(item)
        elif "evidence" in item:
            merged[item_key]["evidence"] = merge_evidence([merged[item_key], item])
    return list(merged.values())


def merge_context_outputs(outputs: list[dict], sources: list[Source]) -> dict:
    """
    Combine the outputs of a split context unit's parts into its output.

    Statements, prerequisites and outline entries are concatenated in part
    order, and one that repeats an earlier one is dropped, its evidence kept
    with the earlier one. The title and description are the first part's
    that has one, and prerequisites are stated when any part states them.

    Args:
        outputs (list of dict): the parts' stored outputs, in unit order
        sources (list of Source): the context unit's sources

    Returns:
        dict: the context unit's output, in the form of an unsplit one's
    """

    def all_items(field):
        return [item for output in outputs for item in output[field]]

    def by_text(statement):
        return normalize(statement["text"])

    return {
        "title": next((o["title"] for o in outputs if o["title"]), ""),
        "stated_audience": _dedupe_by(all_items("stated_audience"), by_text),
        "description": next(
            (o["description"] for o in outputs if o.get("description")), None
        ),
        "objectives": _dedupe_by(all_items("objectives"), by_text),
        "prerequisites_status": min(
            (output["prerequisites_status"] for output in outputs),
            key=PREREQUISITES_STATUS_ORDER.index,
        ),
        "prerequisites": _dedupe_by(
            all_items("prerequisites"),
            lambda prereq: (normalize(prereq["label"]), prereq["kind"]),
        ),
        "required_materials": _dedupe_by(all_items("required_materials"), by_text),
        "instructional_outline": _dedupe_by(
            all_items("instructional_outline"),
            lambda entry: (normalize(entry["unit_label"]), normalize(entry["title"])),
        ),
        "conflicts": all_items("conflicts"),
        # the parts' notes include their sources' truncation notes
        "extraction_notes": list(dict.fromkeys(all_items("extraction_notes"))),
        "sources": [source.summary() for source in sources],
    }


# --------------------------------------------------------------------------- extraction
def _generate_split_context_claims(
    run: LearningResourceRun,
    unit: Unit,
    extractor: ClaimExtractor,
    sources_by_part: list[list[Source]],
    *,
    overwrite: bool,
) -> ClaimExtraction:
    """Extract each part of a split context unit, then combine them"""
    title = run.learning_resource.title
    part_extractions = extract_parts(
        replace(extractor, level=ClaimExtraction.Level.UNIT_PART),
        unit,
        sources_by_part,
        _context_key_inputs(run),
        lambda index, sources: prompts.context_unit_combined_prompt(
            title,
            "\n".join(source.block for source in sources),
            _part_header(index, sources),
        ),
        overwrite=overwrite,
    )
    all_sources = [source for sources in sources_by_part for source in sources]
    return get_or_create_computed_extraction(
        extractor,
        extractor.key(
            "merge",
            *_context_key_inputs(run),
            # a part regenerated with overwrite keeps its key but not its output
            [[part.key, part.output] for part in part_extractions],
        ),
        lambda: merge_context_outputs(
            [part.output for part in part_extractions], all_sources
        ),
        unit=unit,
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
    parts that are then combined.

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
            run has no context unit or its files have no text

    Raises:
        ClaimExtractionError: when the model gives no valid response
    """
    extractor = extractor or load_context_extractor()
    unit, sources = _context_sources(run, extractor)
    if not sources:
        return None
    sources_by_part = pack_parts(sources, extractor.config.input_token_budget)
    if len(sources_by_part) > 1:
        return _generate_split_context_claims(
            run, unit, extractor, sources_by_part, overwrite=overwrite
        )
    # the context unit fits in one call now; parts from an earlier split
    # aren't current
    delete_stale_parts(unit)
    return get_or_create_extraction(
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
