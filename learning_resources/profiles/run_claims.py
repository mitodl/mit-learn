"""
Step 1 of resource profile generation: claims for a run's context unit.

The context unit is extracted before the run's other units, because every
other unit's prompt includes a digest of it and every other unit's key
includes its key.
"""

from collections import Counter
from functools import partial

from learning_resources.models import (
    LearningResourceRun,
    ResourceProfileConfiguration,
    Unit,
)
from learning_resources.profiles import prompts
from learning_resources.profiles.schemas import CourseContextOut
from learning_resources.profiles.sources import Source, unit_sources
from learning_resources.profiles.unit_claims import (
    CourseContext,
    PromptStage,
    _truncation_notes,
    load_stage,
    over_budget,
    stored_or_call,
    title_context,
)
from learning_resources.profiles.verification import verify_all_evidence


def load_context_stage() -> PromptStage:
    """Build the context stage from its ResourceProfileConfiguration"""
    return load_stage(ResourceProfileConfiguration.Stage.CONTEXT, CourseContextOut)


def _context_output(parsed: dict, sources: list[Source]) -> dict:
    """Verify a context output's evidence against its sources and note truncation"""
    output = verify_all_evidence(
        parsed, {source.source_id: source.text for source in sources}
    )
    output["notes"] += _truncation_notes(sources)
    output["sources"] = [source.summary() for source in sources]
    return output


def context_digest(output: dict) -> str:
    """Summarize a context output for the unit prompts"""
    lines = [
        f"Title: {output['title']}",
        f"Description: {output['description']['text']}",
    ]
    if output["stated_audience"]:
        lines.append(
            "Audience: "
            + " | ".join(item["text"] for item in output["stated_audience"])
        )
    prerequisites = "; ".join(
        f"[{item['kind']}] {item['statement']}" for item in output["prerequisites"]
    )
    lines.append(
        f"Prerequisites ({output['prerequisites_status']}): "
        + (prerequisites or "none stated")
    )
    if output["objectives"]:
        lines.append(
            "Objectives: " + " | ".join(item["text"] for item in output["objectives"])
        )
    if output["instructional_outline"]:
        lines.append(
            "Outline: "
            + "; ".join(
                f"{entry['unit_label']} {entry['title']}"
                for entry in output["instructional_outline"]
            )
        )
    return "\n".join(lines)


def generate_context_claims(
    run: LearningResourceRun,
    stage: PromptStage | None = None,
    *,
    overwrite: bool = False,
    stats: Counter | None = None,
) -> CourseContext:
    """
    Extract a run's context unit, or return the stored extraction.

    A run with no context unit, one with no text, or one whose files are over
    the input budget gets a context with the course title alone.

    Args:
        run (LearningResourceRun): the run
        stage (PromptStage): the context stage, loaded from its configuration
            when not given
        overwrite (bool): call the model even when the extraction is stored,
            and replace it
        stats (Counter): counts cache hits, calls made and over-budget units,
            when given

    Returns:
        CourseContext: the context for the run's unit prompts

    Raises:
        ClaimExtractionError: when the model gives no valid response
    """
    stage = stage or load_context_stage()
    config = stage.config
    unit = run.units.filter(kind=Unit.Kind.CONTEXT).first()
    sources = unit_sources(unit, config.max_file_tokens) if unit else []
    if not sources or over_budget(unit, sources, config.input_token_budget, stats):
        return title_context(run)
    title = run.learning_resource.title
    extraction = stored_or_call(
        stage,
        # the title is in the prompt, and the output repeats it
        stage.key(title, [source.cache_input() for source in sources]),
        prompts.context_unit_combined_prompt(
            title,
            "\n".join(source.block for source in sources),
        ),
        partial(_context_output, sources=sources),
        unit=unit,
        overwrite=overwrite,
        stats=stats,
    )
    return CourseContext(extraction.key, context_digest(extraction.output))
