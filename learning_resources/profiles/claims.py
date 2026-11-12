"""
Shared parts of resource profile claim generation.

An extractor is one stage's prompt, output schema and configuration. Its
validated output is stored in the ClaimExtraction of the unit, unit part or
run it is for, under a key its caller builds from the call's inputs, and a call whose
key is already stored, for this unit or run or another, is skipped.
"""

import hashlib
import json
import logging
import types
from collections.abc import Callable
from dataclasses import dataclass, replace
from functools import cached_property
from typing import Union, get_args, get_origin

from django.conf import settings
from django.db import transaction
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_litellm import ChatLiteLLM
from pydantic import BaseModel, ValidationError

from learning_resources.models import (
    ClaimExtraction,
    LearningResourceRun,
    ResourceProfileConfiguration,
    Unit,
)
from learning_resources.profiles.sources import Source
from learning_resources.profiles.verification import verify_all_evidence
from learning_resources.utils import sanitize_llm_text

logger = logging.getLogger(__name__)


class ClaimExtractionError(Exception):
    """An extractor could not produce a valid output"""


def cache_key(*inputs) -> str:
    """
    Return the sha256 of a call's inputs.

    Keys are sorted because a stored output comes back from Postgres jsonb
    with its keys in a different order than the model gave them.
    """
    blob = json.dumps(inputs, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    return hashlib.sha256(blob.encode()).hexdigest()


@dataclass(frozen=True)
class ClaimExtractor:
    """One kind of LLM call: its prompt, output schema and configuration"""

    # a ResourceProfileConfiguration.Stage
    stage: str
    level: str
    system: str
    # every extractor's schema has extraction_notes, for notes on dropped claims and
    # truncated sources
    schema: type[BaseModel]
    config: ResourceProfileConfiguration

    @cached_property
    def version(self) -> str:
        """The stage and when its configuration was last saved"""
        return f"{self.stage}-{self.config.updated_on:%Y%m%dT%H%M%S}"

    def key(self, *inputs) -> str:
        """Return the cache key for a call of this extractor with these inputs"""
        return cache_key(self.level, *inputs)


def load_extractor(
    stage: str,
    schema: type[BaseModel],
    level: str = ClaimExtraction.Level.UNIT,
) -> ClaimExtractor:
    """
    Build a stage's extractor from its ResourceProfileConfiguration.

    Args:
        stage (str): a ResourceProfileConfiguration.Stage
        schema (type of BaseModel): the extractor's output schema
        level (str): the ClaimExtraction.Level its rows are stored at

    Raises:
        ClaimExtractionError: when the stage has no configuration
    """
    config = ResourceProfileConfiguration.objects.filter(stage=stage).first()
    if not config:
        msg = f"No ResourceProfileConfiguration for stage {stage}"
        raise ClaimExtractionError(msg)
    return ClaimExtractor(stage, level, config.prompt, schema, config)


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


def _optional_schema(annotation) -> type[BaseModel] | None:
    """Return the model of a Model | None field annotation, or None"""
    if get_origin(annotation) not in (Union, types.UnionType):
        return None
    args = [arg for arg in get_args(annotation) if arg is not type(None)]
    if len(args) == 1 and isinstance(args[0], type) and issubclass(args[0], BaseModel):
        return args[0]
    return None


def _drop_note(field: str, index: int | None, item, error: ValidationError) -> str:
    label = item.get("label") if isinstance(item, dict) else None
    first = error.errors()[0]
    location = ".".join(str(part) for part in first["loc"]) or "item"
    return (
        f"Dropped {field}"
        + (f" item {index}" if index is not None else "")
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
    is validated on its own and left out if it fails, and an optional model
    field that fails is set to None.

    Args:
        schema (type of BaseModel): the extractor's output schema
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
        optional_schema = _optional_schema(field.annotation)
        if optional_schema is not None and data.get(name) is not None:
            try:
                data[name] = optional_schema.model_validate(data[name])
            except ValidationError as error:
                notes.append(_drop_note(name, None, data[name], error))
                data[name] = None
            continue
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


def _salvage(extractor: ClaimExtractor, message: BaseMessage) -> BaseModel:
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
    parsed, notes = validate_dropping_invalid_claims(extractor.schema, calls[0]["args"])
    if notes:
        logger.warning("%s: %s", extractor.stage, "; ".join(notes))
        parsed.extraction_notes += notes
    return parsed


def call_llm(extractor: ClaimExtractor, combined_prompt: str) -> tuple[BaseModel, str]:
    """
    Ask the model for an extractor's structured output.

    Claims that don't validate are dropped, with a note, rather than failing
    the response. A response that still doesn't validate isn't requested
    again: with the same input, the model mostly fails the same way.

    Returns:
        tuple of (BaseModel, str): the validated output, and the response
            as the model returned it

    Raises:
        ClaimExtractionError: when the response doesn't validate
    """
    config = extractor.config
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
    ).with_structured_output(
        extractor.schema, method="function_calling", include_raw=True
    )
    messages = [
        SystemMessage(content=extractor.system),
        HumanMessage(content=combined_prompt),
    ]
    result = llm.invoke(messages)
    raw = _raw_response(result["raw"])
    if result["parsed"] is not None:
        return result["parsed"], raw
    try:
        return _salvage(extractor, result["raw"]), raw
    except (ValidationError, ValueError) as error:
        msg = f"{extractor.stage}: no valid {extractor.schema.__name__}: {error}"
        raise ClaimExtractionError(msg) from error


# --------------------------------------------------------------------------- outputs
def truncation_notes(sources: list[Source]) -> list[str]:
    return [
        f"{source.source_id} was truncated: {source.included_chars:,} of"
        f" {source.total_chars:,} characters were read"
        for source in sources
        if source.truncated
    ]


def _stored_output(parsed: dict, sources: list[Source]) -> dict:
    """Verify an output's evidence against its sources and note truncation"""
    output = verify_all_evidence(
        parsed, {source.source_id: source.text for source in sources}
    )
    output["extraction_notes"] += truncation_notes(sources)
    output["sources"] = [source.summary() for source in sources]
    return output


# --------------------------------------------------------------------------- extraction
def merge_evidence(claims: list[dict]) -> list[dict]:
    """Return the evidence of several claims, without repeats"""
    evidence, seen = [], set()
    for claim in claims:
        for item in claim.get("evidence", []):
            marker = (item["source_id"], item["passage"])
            if marker not in seen:
                seen.add(marker)
                evidence.append(item)
    return evidence


def delete_stale_parts(unit: Unit, keep_first: int = 0) -> None:
    """
    Delete a unit's part extractions after the first `keep_first`: the rest are
    left from an earlier, longer split.

    Call it only once the unit's own extraction has been stored, since until
    then the unit's earlier merged extraction cites these parts.
    """
    ClaimExtraction.objects.filter(
        unit=unit, level=ClaimExtraction.Level.UNIT_PART, part__gt=keep_first
    ).delete()


def part_header(index: int, sources: list[Source], subject: str, rest: str) -> str:
    """
    Return the line that tells the model which part of a split unit it reads

    Args:
        index (int): the part's index, from 1
        sources (list of Source): the part's sources
        subject (str): what is split, like "the unit"
        rest (str): what the model is told about reading only a part
    """
    return (
        f"PART {index} of {subject}: sources {sources[0].source_id}-"
        f"{sources[-1].source_id}. {rest}"
    )


def _extract_parts(  # noqa: PLR0913
    extractor: ClaimExtractor,
    unit: Unit,
    sources_by_part: list[list[Source]],
    key_inputs: list,
    build_prompt: Callable[[int, list[Source]], str],
    *,
    finish: Callable[[dict], dict] | None = None,
    overwrite: bool = False,
) -> list[ClaimExtraction]:
    """
    Extract each part of a split unit.

    Source ids run through the whole unit, so a part's evidence cites the same
    ids as the unit's sources. A part is keyed by its unit, its position and
    its sources' ids and text, and not by the number of parts, so a part is
    reused when parts are added after it. The unit is in the key so that a
    part row belongs to one unit: units that share a part's sources, like
    two bins whose first files are the same, each get their own row rather
    than taking one row back from each other.

    Args:
        extractor (ClaimExtractor): the part extractor, at the unit_part level
        unit (Unit): the split unit
        sources_by_part (list of list of Source): each part's sources, from
            pack_parts
        key_inputs (list): what else the parts' keys are built from, like the
            course and the unit's title
        build_prompt (callable): returns a part's prompt, given its index
            from 1 and its sources
        finish (callable): passed to get_or_create_extraction for each part
        overwrite (bool): call the model for every part, even when stored

    Returns:
        list of ClaimExtraction: the parts, in unit order

    Raises:
        ClaimExtractionError: when the model gives no valid response for a part
    """
    part_extractions = []
    for index, sources in enumerate(sources_by_part, 1):
        part_extractions.append(
            get_or_create_extraction(
                extractor,
                extractor.key(
                    unit.id,
                    *key_inputs,
                    index,
                    [[source.source_id, source.cache_input()] for source in sources],
                ),
                lambda index=index, sources=sources: build_prompt(index, sources),
                sources,
                unit=unit,
                part=index,
                finish=finish,
                overwrite=overwrite,
            )
        )
    return part_extractions


def extract_split_unit(  # noqa: PLR0913
    extractor: ClaimExtractor,
    merge_extractor: ClaimExtractor,
    unit: Unit,
    *,
    sources_by_part: list[list[Source]],
    key_inputs: list,
    build_part_prompt: Callable[[int, list[Source]], str],
    merge: Callable[[list[ClaimExtraction]], dict],
    finish_part: Callable[[dict], dict] | None = None,
    overwrite: bool = False,
) -> ClaimExtraction:
    """
    Extract each part of a split unit, then merge them into the unit's row.

    Parts left from a longer split are deleted only once the merge is
    stored: until then the unit's earlier merge comes from them.

    Args:
        extractor (ClaimExtractor): the unit's extractor; parts are extracted
            with it at the unit_part level
        merge_extractor (ClaimExtractor): the extractor the merged row is
            stored with
        unit (Unit): the split unit
        sources_by_part (list of list of Source): each part's sources, from
            pack_parts
        key_inputs (list): what else the keys are built from, like the course
            and the unit's title
        build_part_prompt (callable): returns a part's prompt, given its index
            from 1 and its sources
        merge (callable): given the parts, returns how the merge is made, as
            keyword arguments for get_or_create_extraction: build_prompt,
            sources and finish for a model call, or compute
        finish_part (callable): passed to get_or_create_extraction for each part
        overwrite (bool): call the model for every part and the merge, even
            when stored

    Raises:
        ClaimExtractionError: when the model gives no valid response
    """
    part_extractions = _extract_parts(
        replace(extractor, level=ClaimExtraction.Level.UNIT_PART),
        unit,
        sources_by_part,
        key_inputs,
        build_part_prompt,
        finish=finish_part,
        overwrite=overwrite,
    )
    extraction = get_or_create_extraction(
        merge_extractor,
        merge_extractor.key(
            "merge",
            *key_inputs,
            # a part regenerated with overwrite keeps its key but not its output
            [[part.key, part.output] for part in part_extractions],
        ),
        unit=unit,
        overwrite=overwrite,
        **merge(part_extractions),
    )
    delete_stale_parts(unit, keep_first=len(part_extractions))
    return extraction


def get_or_create_extraction(  # noqa: PLR0913
    extractor: ClaimExtractor,
    key: str,
    build_prompt: Callable[[], str] | None = None,
    sources: list[Source] = (),
    *,
    compute: Callable[[], dict] | None = None,
    unit: Unit | None = None,
    run: LearningResourceRun | None = None,
    part: int | None = None,
    finish: Callable[[dict], dict] | None = None,
    overwrite: bool = False,
) -> ClaimExtraction:
    """
    Return the extraction for a key, calling the model if there is none.

    An output that is computed in code rather than by the model, like a split
    context unit's combined parts, is given as `compute` instead of
    `build_prompt`; it is stored the same way, with no raw response.

    Units with the same inputs share the key's row, which is pointed at the
    unit asking for it, so `unit` is the unit that used the row last. The
    unit's other rows at the extractor's level, and for the same part, are no
    longer current and are deleted, leaving it one of each.

    Args:
        extractor (ClaimExtractor): the extractor to call
        key (str): the call's cache key
        build_prompt (callable): returns the course material for the call,
            called only when the model is
        sources (list of Source): the sources in the prompt, to verify the
            output's evidence against
        compute (callable): returns the output, in place of a model call;
            exactly one of build_prompt and compute is given. The key must be
            built from what compute() reads, so a stored row is what it
            would return.
        unit (Unit): the unit the call is for, for a unit-level extraction
        run (LearningResourceRun): the run the call is for, for a run-level
            extraction; exactly one of unit and run is given
        part (int): the part of the unit the call is for, for a unit_part
            extraction
        finish (callable): what else to do to the verified output, as plain
            data, before it is stored
        overwrite (bool): call the model even when the key is stored, and
            replace the stored extraction

    Raises:
        ClaimExtractionError: when the model gives no valid response
    """
    if (unit is None) == (run is None):
        msg = "Pass exactly one of unit and run"
        raise ValueError(msg)
    if (build_prompt is None) == (compute is None):
        msg = "Pass exactly one of build_prompt and compute"
        raise ValueError(msg)
    if not overwrite:
        extraction = ClaimExtraction.objects.filter(key=key).first()
        if extraction:
            return _store_extraction(
                extraction, unit=unit, run=run, level=extractor.level, part=part
            )
    if compute is not None:
        output, raw, version = compute(), "", f"{extractor.version}-merge"
    else:
        parsed, raw = call_llm(extractor, build_prompt())
        output = _stored_output(parsed.model_dump(), sources)
        version = extractor.version
    if finish:
        output = finish(output)
    return _store_extraction(
        ClaimExtraction.objects.filter(key=key).first(),
        unit=unit,
        run=run,
        level=extractor.level,
        part=part,
        key=key,
        extractor_version=version,
        model=extractor.config.llm_model,
        output=_sanitize(output),
        raw_response=sanitize_llm_text(raw),
        # a replaced extraction is unpublished until the next claim generation
        # sweep of its course publishes it again
        published=False,
    )


def _store_extraction(
    extraction: ClaimExtraction | None,
    *,
    unit: Unit | None,
    run: LearningResourceRun | None,
    level: str,
    part: int | None = None,
    **fields,
) -> ClaimExtraction:
    """
    Point an extraction at its unit or run, and delete that unit's or run's
    other extractions at the same level and part.

    A split unit has a row for each part and one for the whole unit, which
    merges them, so a unit's rows are told apart by level and part.

    Args:
        extraction (ClaimExtraction | None): the row for the key, if there is
            one; otherwise the unit's or run's latest row is reused for the
            key, or a row is created
        unit (Unit | None): the unit the row is for, for a unit-level extraction
        run (LearningResourceRun | None): the run the row is for, for a
            run-level extraction; exactly one of unit and run is given
        level (str): the row's ClaimExtraction.Level
        part (int | None): the row's part, for a unit_part extraction
        fields: what else to set on the row
    """
    owner_field, owner = ("unit", unit) if unit is not None else ("run", run)
    scope = {owner_field: owner, "level": level, "part": part}
    with transaction.atomic():
        rows = ClaimExtraction.objects.select_for_update().filter(**scope)
        if extraction is None:
            extraction = rows.order_by("-updated_on", "-id").first()
        if extraction is None:
            extraction = ClaimExtraction.objects.create(**scope, **fields)
        else:
            rows.exclude(id=extraction.id).delete()
            if (
                fields
                or getattr(extraction, f"{owner_field}_id") != owner.id
                or extraction.part != part
            ):
                setattr(extraction, owner_field, owner)
                extraction.part = part
                for name, value in fields.items():
                    setattr(extraction, name, value)
                extraction.save()
    return extraction
