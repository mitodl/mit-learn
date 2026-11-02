"""
Step 1 of resource profile generation: claims for a run's context unit.

The context unit holds content about the course as a whole, like the
syllabus. Its claims are kept apart from the units' claims: unit prompts are
given an outline built from the run's units, not these claims, so the context
and the units can be extracted in any order.
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
from learning_resources.profiles.schemas import CourseContextOut
from learning_resources.profiles.sources import Source, unit_sources


def load_context_extractor() -> ClaimExtractor:
    """Build the context extractor from its ResourceProfileConfiguration"""
    return load_extractor(ResourceProfileConfiguration.Stage.CONTEXT, CourseContextOut)


def _context_sources(
    run: LearningResourceRun, extractor: ClaimExtractor
) -> tuple[Unit | None, list[Source]]:
    """Return a run's context unit and its sources"""
    unit = run.units.filter(kind=Unit.Kind.CONTEXT).first()
    return unit, unit_sources(unit, extractor.config.max_file_tokens) if unit else []


def _context_key(
    extractor: ClaimExtractor, run: LearningResourceRun, sources: list[Source]
) -> str:
    # the title is in the prompt, and the output repeats it
    return extractor.key(
        run.learning_resource.title, [source.cache_input() for source in sources]
    )


def generate_context_claims(
    run: LearningResourceRun,
    extractor: ClaimExtractor | None = None,
    *,
    overwrite: bool = False,
) -> ClaimExtraction | None:
    """
    Extract a run's context unit, or return the stored extraction.

    Args:
        run (LearningResourceRun): the run
        extractor (ClaimExtractor): the context extractor, loaded from its
            configuration when not given
        overwrite (bool): call the model even when an extraction with the
            same key is stored, and replace it. The key covers only the
            course title and the files' text, so this is how a prompt, model
            or code change is applied to stored claims.

    Returns:
        ClaimExtraction | None: the context unit's extraction, or None when the
            run has no context unit, its files have no text, or they are over
            the input budget

    Raises:
        ClaimExtractionError: when the model gives no valid response
    """
    extractor = extractor or load_context_extractor()
    unit, sources = _context_sources(run, extractor)
    if not sources:
        return None
    if over_budget(unit, sources, extractor.config.input_token_budget):
        return None
    return get_or_create_extraction(
        extractor,
        _context_key(extractor, run, sources),
        lambda: prompts.context_unit_combined_prompt(
            run.learning_resource.title,
            "\n".join(source.block for source in sources),
        ),
        sources,
        unit=unit,
        overwrite=overwrite,
    )
