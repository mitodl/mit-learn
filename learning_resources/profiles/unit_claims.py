"""
Step 1 of resource profile generation: claims for one unit.

A unit's files are sent to the model in one call, and its validated output is
stored in ClaimExtraction under a key built from the text of its files and
the course outline its prompt is given. A call whose key is already stored is
skipped, so a unit whose files and course outline haven't changed is never
sent twice, even from another run of the course. The prompt and model are
left out of the key: after changing them, stored claims are regenerated only
with overwrite.
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
    get_or_create_extraction,
    load_extractor,
    over_budget,
)
from learning_resources.profiles.schemas import UnitExtraction
from learning_resources.profiles.sources import unit_sources

# claim lists in a unit output, and the prefix of their claim ids
CLAIM_PREFIXES = {
    "concepts": "c",
    "skills": "s",
    "assumed_knowledge": "a",
    "assessment_expectations": "t",
}


def load_unit_extractor() -> ClaimExtractor:
    """Build the unit extractor from its ResourceProfileConfiguration"""
    return load_extractor(ResourceProfileConfiguration.Stage.UNIT, UnitExtraction)


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
        line += f" | unit {unit_ids.index(unit.id) + 1} of {len(unit_ids)}"
    lines = [line]
    if unit.kind == Unit.Kind.BIN:
        lines.append(
            "These files are not part of a course unit. They are grouped by where"
            " the course links them or by type, and their order is not meaningful."
        )
    return "\n".join(lines)


# --------------------------------------------------------------------------- extraction
def generate_unit_claims(
    unit: Unit,
    *,
    overwrite: bool = False,
) -> ClaimExtraction | None:
    """
    Generate the claims for one unit or bin, or return the stored ones.

    The prompt is given the course title and the run's units in order, along
    with the unit's own files.

    Args:
        unit (Unit): the unit or bin
        overwrite (bool): call the model even when an extraction with the
            same key is stored, and replace it. The key covers only the
            files' text and the prompt's outline and header, so this is how a
            prompt, model or code change is applied to stored claims.

    Returns:
        ClaimExtraction | None: the unit's extraction, or None when the unit
            has no files with text or its files are over the input budget

    Raises:
        ClaimExtractionError: when the model gives no valid response
        ValueError: for the context unit, which generate_context_claims extracts
    """
    if unit.kind == Unit.Kind.CONTEXT:
        msg = "The context unit is extracted with generate_context_claims"
        raise ValueError(msg)
    extractor = load_unit_extractor()
    config = extractor.config
    sources = unit_sources(unit, config.max_file_tokens)
    if not sources:
        return None
    if over_budget(unit, sources, config.input_token_budget):
        return None
    outline, unit_ids = _course_outline(unit.run)
    header = _unit_header(unit, unit_ids)
    return get_or_create_extraction(
        extractor,
        extractor.key([source.cache_input() for source in sources], outline, header),
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
