"""
Step 1 of resource profile generation: claims for one unit.

A unit's files are sent to the model in one call, and its validated output is
stored in ClaimExtraction under a key built from the text of its files and
the key of its run's context unit. A call whose key is already stored is
skipped, so a unit whose files and course context haven't changed is never
sent twice, even from another run of the course. The prompt and model are
left out of the key: after changing them, stored claims are regenerated only
with overwrite.
"""

import hashlib
import json
import logging
from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass
from functools import cached_property, partial
from typing import get_args, get_origin

from django.conf import settings
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_litellm import ChatLiteLLM
from pydantic import BaseModel, ValidationError

from learning_resources.models import (
    ClaimExtraction,
    LearningResourceRun,
    ResourceProfileConfiguration,
    Unit,
)
from learning_resources.profiles import prompts
from learning_resources.profiles.schemas import UnitExtraction
from learning_resources.profiles.sources import Source, unit_sources
from learning_resources.profiles.verification import verify_all_evidence
from learning_resources.utils import sanitize_llm_text

logger = logging.getLogger(__name__)

# claim lists in a unit output, and the prefix of their claim ids
CLAIM_PREFIXES = {
    "concepts": "c",
    "skills": "s",
    "assumed_knowledge": "a",
    "assessment_expectations": "t",
}

# the field a stage's output schema keeps its notes in, by schema
NOTES_FIELDS = ("extraction_notes", "notes")


class ClaimExtractionError(Exception):
    """A stage could not produce a valid output"""


def cache_key(*inputs) -> str:
    """Return the sha256 of a call's inputs"""
    blob = json.dumps(inputs, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(blob.encode()).hexdigest()


@dataclass(frozen=True)
class PromptStage:
    """One kind of LLM call: its prompt, output schema and configuration"""

    name: str
    level: str
    system: str
    schema: type[BaseModel]
    config: ResourceProfileConfiguration

    @cached_property
    def version(self) -> str:
        """The stage name and when its configuration was last saved"""
        return f"{self.name}-{self.config.updated_on:%Y%m%dT%H%M%S}"

    def key(self, *inputs) -> str:
        """Return the cache key for a call of this stage with these inputs"""
        return cache_key(self.level, *inputs)


def load_stage(stage: str, schema: type[BaseModel]) -> PromptStage:
    """
    Build a stage from its ResourceProfileConfiguration.

    Args:
        stage (str): a ResourceProfileConfiguration.Stage
        schema (type of BaseModel): the stage's output schema

    Raises:
        ClaimExtractionError: when the stage has no configuration
    """
    config = ResourceProfileConfiguration.objects.filter(stage=stage).first()
    if not config:
        msg = f"No ResourceProfileConfiguration for stage {stage}"
        raise ClaimExtractionError(msg)
    return PromptStage(stage, ClaimExtraction.Level.UNIT, config.prompt, schema, config)


def load_unit_stage() -> PromptStage:
    """Build the unit stage from its ResourceProfileConfiguration"""
    return load_stage(ResourceProfileConfiguration.Stage.UNIT, UnitExtraction)


# --------------------------------------------------------------------------- llm
def _sanitize(value):
    """Strip characters Postgres can't store, at any depth of the output"""
    if isinstance(value, str):
        return sanitize_llm_text(value)
    if isinstance(value, list):
        return [_sanitize(item) for item in value]
    if isinstance(value, dict):
        return {key: _sanitize(item) for key, item in value.items()}
    return value


def _raw_response(message: BaseMessage) -> str:
    """Return the model's response as it was sent: its tool call arguments"""
    calls = message.additional_kwargs.get("tool_calls") or []
    arguments = [(call.get("function") or {}).get("arguments") or "" for call in calls]
    if any(arguments):
        return "\n".join(arguments)
    if message.content:
        return str(message.content)
    return json.dumps(getattr(message, "tool_calls", []), ensure_ascii=False)


def _item_schema(annotation) -> type[BaseModel] | None:
    """Return the model of a list[Model] field annotation, or None"""
    args = get_args(annotation)
    if get_origin(annotation) is list and args and isinstance(args[0], type):
        return args[0] if issubclass(args[0], BaseModel) else None
    return None


def _drop_note(field: str, index: int, item, error: ValidationError) -> str:
    label = item.get("label") if isinstance(item, dict) else None
    first = error.errors()[0]
    location = ".".join(str(part) for part in first["loc"]) or "item"
    return (
        f"Dropped {field} item {index}"
        + (f" ({label!r})" if label else "")
        + f", which did not validate: {location}: {first['msg']}"
    )


def validate_dropping_invalid_claims(
    schema: type[BaseModel], data: dict
) -> tuple[BaseModel, list[str]]:
    """
    Validate a model's output, dropping the claims that don't validate.

    One malformed claim, like an over-long passage or an unknown kind, would
    otherwise fail the whole output. Each item of every list-of-models field
    is validated on its own and left out if it fails.

    Args:
        schema (type of BaseModel): the stage's output schema
        data (dict): the tool call arguments the model returned

    Returns:
        tuple of (BaseModel, list of str): the validated output, and a note
            for each claim that was dropped

    Raises:
        ValidationError: when the output is invalid apart from its claims
    """
    data = dict(data)
    notes = []
    for name, field in schema.model_fields.items():
        item_schema = _item_schema(field.annotation)
        items = data.get(name)
        if item_schema is None or not isinstance(items, list):
            continue
        kept = []
        for index, item in enumerate(items, 1):
            try:
                kept.append(item_schema.model_validate(item))
            except ValidationError as error:
                notes.append(_drop_note(name, index, item, error))
        data[name] = kept
    return schema.model_validate(data), notes


def _salvage(stage: PromptStage, message: BaseMessage) -> BaseModel:
    """
    Recover an output that failed validation by dropping its invalid claims.

    Raises:
        ValidationError: when the output is invalid apart from its claims
        ValueError: when the response has no tool call to recover
    """
    calls = getattr(message, "tool_calls", None) or []
    if not calls:
        msg = "the response has no tool call"
        raise ValueError(msg)
    parsed, notes = validate_dropping_invalid_claims(stage.schema, calls[0]["args"])
    if notes:
        logger.warning("%s: %s", stage.name, "; ".join(notes))
        notes_field = next(
            (name for name in NOTES_FIELDS if name in stage.schema.model_fields),
            None,
        )
        if notes_field:
            getattr(parsed, notes_field).extend(notes)
    return parsed


def call_llm(stage: PromptStage, combined_prompt: str) -> tuple[BaseModel, str]:
    """
    Ask the model for a stage's structured output.

    Claims that don't validate are dropped, with a note, rather than failing
    the response. A response that still doesn't validate isn't requested
    again: with the same input, the model mostly fails the same way.

    Returns:
        tuple of (BaseModel, str): the validated output, and the response
            as the model returned it

    Raises:
        ClaimExtractionError: when the response doesn't validate
    """
    config = stage.config
    # unset parameters are left out, for models that reject them
    model_kwargs = {}
    if config.max_completion_tokens is not None:
        model_kwargs["max_completion_tokens"] = config.max_completion_tokens
    if config.reasoning_effort is not None:
        model_kwargs["reasoning_effort"] = config.reasoning_effort
        # litellm refuses it for models missing from its model map, like newer
        # ones, even when the provider takes it
        model_kwargs["allowed_openai_params"] = ["reasoning_effort"]
    llm = ChatLiteLLM(
        model=config.llm_model,
        temperature=config.temperature,
        max_tokens=config.max_tokens,
        model_kwargs=model_kwargs,
        api_base=settings.LITELLM_API_BASE,
        request_timeout=settings.RESOURCE_PROFILE_LLM_TIMEOUT,
        # Tool calling, not the default json_schema: OpenAI's strict json_schema
        # mode rejects optional fields, and pydantic validates the response anyway.
    ).with_structured_output(stage.schema, method="function_calling", include_raw=True)
    messages = [
        SystemMessage(content=stage.system),
        HumanMessage(content=combined_prompt),
    ]
    result = llm.invoke(messages)
    raw = _raw_response(result["raw"])
    if result["parsed"] is not None:
        return result["parsed"], raw
    try:
        return _salvage(stage, result["raw"]), raw
    except (ValidationError, ValueError) as error:
        msg = f"{stage.name}: no valid {stage.schema.__name__}: {error}"
        raise ClaimExtractionError(msg) from error


# --------------------------------------------------------------------------- outputs
def _number_claims(output: dict) -> dict:
    """Give each claim in a unit output an id: c1, s1, a1, t1, ..."""
    for key, prefix in CLAIM_PREFIXES.items():
        output[key] = [
            {"id": f"{prefix}{index}", **claim}
            for index, claim in enumerate(output[key], 1)
        ]
    return output


def _truncation_notes(sources: list[Source]) -> list[str]:
    return [
        f"{source.source_id} was truncated: {source.included_chars:,} of"
        f" {source.total_chars:,} characters were read"
        for source in sources
        if source.truncated
    ]


def _unit_output(parsed: dict, sources: list[Source]) -> dict:
    """Verify a unit output's evidence against its sources and note truncation"""
    output = _number_claims(
        verify_all_evidence(
            parsed, {source.source_id: source.text for source in sources}
        )
    )
    output["extraction_notes"] += _truncation_notes(sources)
    output["sources"] = [source.summary() for source in sources]
    return output


def _unit_header(unit: Unit) -> str:
    lines = [f"title={unit.title!r} | kind={unit.kind}"]
    if unit.kind == Unit.Kind.BIN:
        lines.append(
            "These files are not part of a course unit. They are grouped by where"
            " the course links them or by type, and their order is not meaningful."
        )
    return "\n".join(lines)


@dataclass(frozen=True)
class CourseContext:
    """What a unit prompt is given about the course"""

    # the context unit's extraction key, empty when there is no context
    key: str
    digest: str


def title_context(run: LearningResourceRun) -> CourseContext:
    """Return a context with only the course title, for runs with no context"""
    title = run.learning_resource.title
    return CourseContext("", f"Title: {title}\nNo course context is available.")


# --------------------------------------------------------------------------- extraction
def over_budget(
    unit: Unit, sources: list[Source], budget: int, stats: Counter | None = None
) -> bool:
    """Log and count a unit whose files are over the input budget"""
    tokens = sum(source.tokens for source in sources)
    if tokens <= budget:
        return False
    logger.warning(
        "Skipping %s %s of run %s: %d files, about %d tokens, over the"
        " input budget of %d",
        unit.kind,
        unit.external_id,
        unit.run.run_id,
        len(sources),
        tokens,
        budget,
    )
    if stats is not None:
        stats["over_budget"] += 1
    return True


def stored_or_call(  # noqa: PLR0913
    stage: PromptStage,
    key: str,
    combined_prompt: str,
    finish: Callable[[dict], dict],
    *,
    unit: Unit,
    overwrite: bool = False,
    stats: Counter | None = None,
) -> ClaimExtraction:
    """
    Return the stored extraction for a key, calling the model if there is none.

    Args:
        stage (PromptStage): the stage to call
        key (str): the call's cache key
        combined_prompt (str): the course material for the call
        finish (callable): turns the model's validated output, as plain data,
            into what is stored
        unit (Unit): the unit the call is for
        overwrite (bool): call the model even when the key is stored, and
            replace the stored extraction
        stats (Counter): counts cache hits and calls made, when given

    Raises:
        ClaimExtractionError: when the model gives no valid response
    """
    stats = Counter() if stats is None else stats
    if not overwrite:
        extraction = ClaimExtraction.objects.filter(key=key).first()
        if extraction:
            stats["cached"] += 1
            return extraction
    parsed, raw = call_llm(stage, combined_prompt)
    stats["generated"] += 1
    extraction, _ = ClaimExtraction.objects.update_or_create(
        key=key,
        defaults={
            "level": stage.level,
            "extractor_version": stage.version,
            "model": stage.config.llm_model,
            "output": _sanitize(finish(parsed.model_dump())),
            "raw_response": sanitize_llm_text(raw),
            "unit": unit,
        },
    )
    return extraction


def generate_unit_claims(
    unit: Unit,
    context: CourseContext,
    stage: PromptStage | None = None,
    *,
    overwrite: bool = False,
    stats: Counter | None = None,
) -> ClaimExtraction | None:
    """
    Generate the claims for one unit or bin, or return the stored ones.

    Args:
        unit (Unit): the unit or bin
        context (CourseContext): what the prompt says about the course, from
            generate_context_claims, or title_context for no context
        stage (PromptStage): the unit stage, loaded from its configuration
            when not given
        overwrite (bool): call the model even when an extraction with the
            same key is stored, and replace it. The key covers only the
            files' text and the context, so this is how a prompt, model or
            code change is applied to stored claims.
        stats (Counter): counts skipped and over-budget units, cache hits and
            calls made, when given

    Returns:
        ClaimExtraction | None: the unit's extraction, or None when the unit
            has no files with text or its files are over the input budget

    Raises:
        ClaimExtractionError: when the model gives no valid response
    """
    stage = stage or load_unit_stage()
    config = stage.config
    sources = unit_sources(unit, config.max_file_tokens)
    if not sources:
        if stats is not None:
            stats["skipped"] += 1
        return None
    if over_budget(unit, sources, config.input_token_budget, stats):
        return None
    return stored_or_call(
        stage,
        stage.key([source.cache_input() for source in sources], context.key),
        prompts.unit_combined_prompt(
            context.digest,
            _unit_header(unit),
            "\n".join(source.block for source in sources),
        ),
        partial(_unit_output, sources=sources),
        unit=unit,
        overwrite=overwrite,
        stats=stats,
    )
