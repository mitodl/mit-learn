"""
Shared parts of resource profile claim generation.

An extractor is one stage's prompt, output schema and configuration. Its
validated output is stored in the ClaimExtraction of the unit, unit part or
run it is for, under a key its caller builds from the call's inputs, and a call whose
key is already stored, for this unit or run or another, is skipped.
"""

import functools
import hashlib
import json
import logging
import re
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
from learning_resources.profiles.sources import Source, estimate_tokens
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


# --------------------------------------------------------------------------- merge
# A split unit's parts are merged by a merge call, which decides which part
# claims are the same claim; code checks only the part claim ids it cites.
_PART_CLAIM_ID = re.compile(r"P(\d+):([a-z]+)(\d+)", re.IGNORECASE)


def normalize_part_claim_id(claim_id: str) -> str:
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


def cited_part_claim_ids(
    claim_ids: list[str], part_claims: dict[str, tuple[str, dict]], kinds: set[str]
) -> list[str]:
    """
    Return the part claim ids a merged claim cites that exist and are of one
    of `kinds`, normalized and without repeats

    Args:
        claim_ids (list of str): the ids as the merge model wrote them
        part_claims (dict): each part claim, as id: (kind, claim)
        kinds (set of str): the kinds the merged claim may cite, like
            {"concepts"}
    """
    return [
        claim_id
        for claim_id in dict.fromkeys(map(normalize_part_claim_id, claim_ids))
        if part_claims.get(claim_id, (None,))[0] in kinds
    ]


def part_claim_as_merged(claim_id: str, claim: dict) -> dict:
    """Return a part claim the merge left out as a merged claim of its own"""
    return {
        **{name: value for name, value in claim.items() if name != "id"},
        "part_claim_ids": [claim_id],
    }


def merge_token_limit(config: ResourceProfileConfiguration) -> int:
    """
    Return the most tokens a merge call may take: its input budget, or its
    output limit when that is lower, since the merge writes the parts'
    claims out again
    """
    limits = (
        config.input_token_budget,
        config.max_completion_tokens,
        config.max_tokens,
    )
    return min(limit for limit in limits if limit is not None)


def merge_parts(  # noqa: PLR0913
    extractor: ClaimExtractor,
    key: str,
    build_prompt: Callable[[], str],
    sources: list[Source],
    *,
    unit: Unit,
    finish: Callable[[dict], dict],
    overwrite: bool = False,
) -> ClaimExtraction | None:
    """
    Merge a split unit's parts with the merge model, or return None when the
    call would be over the merge's token limit.

    There is no fallback: a merge call over the limit is logged as an error
    and the unit is skipped, and one with no valid response raises, so the
    unit fails and is tried again on the next sweep. The limit is checked
    only when the merge isn't stored, against the system prompt and the
    prompt together.

    Args:
        extractor (ClaimExtractor): the merge extractor
        key (str): the merge's cache key
        build_prompt (callable): returns the merge prompt, with the parts'
            records
        sources (list of Source): the unit's sources
        unit (Unit): the split unit
        finish (callable): resolves the merge output's part claim citations
        overwrite (bool): merge even when the key is stored

    Raises:
        ClaimExtractionError: when the model gives no valid response
    """
    build_prompt = functools.cache(build_prompt)
    if overwrite or not ClaimExtraction.objects.filter(key=key).exists():
        tokens = estimate_tokens(extractor.system) + estimate_tokens(build_prompt())
        limit = merge_token_limit(extractor.config)
        if tokens > limit:
            logger.error(
                "Not merging the parts of %s %s of run %s: the merge call, about"
                " %d tokens, is over the %s limit of %d",
                unit.kind,
                unit.external_id,
                unit.run.run_id,
                tokens,
                extractor.stage,
                limit,
            )
            return None
    return get_or_create_extraction(
        extractor,
        key,
        build_prompt,
        sources,
        unit=unit,
        finish=finish,
        overwrite=overwrite,
    )


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


def delete_stale_parts(unit: Unit, keep: list[ClaimExtraction] = ()) -> None:
    """
    Delete a unit's part extractions other than `keep` that no merge cites:
    the rest are left from an earlier split, or from before the unit fit in
    one call.

    A part row is shared by the units whose parts have its key, and points at
    the unit that used it last, so a part that is stale for this unit can
    still be current for another unit of the course. A part is kept while a
    unit-level row lists it in its part_keys, which also keeps the parts this
    unit's earlier merge cites until that merge is replaced. Call it once the
    unit's own extraction has been stored, or nothing of the earlier merge's
    is deleted.

    Args:
        unit (Unit): the unit
        keep (list of ClaimExtraction): the unit's current parts
    """
    stale = ClaimExtraction.objects.filter(
        unit=unit, level=ClaimExtraction.Level.UNIT_PART
    ).exclude(id__in=[part.id for part in keep])
    stale_keys = list(stale.values_list("key", flat=True))
    if not stale_keys:
        return
    # a part's key includes the course, so only the course's merges cite it
    citing = ClaimExtraction.objects.filter(
        level=ClaimExtraction.Level.UNIT,
        unit__run__learning_resource_id=unit.run.learning_resource_id,
        output__part_keys__has_any_keys=stale_keys,
    ).values_list("output__part_keys", flat=True)
    cited = {key for part_keys in citing for key in part_keys}
    stale.exclude(key__in=cited).delete()


def too_many_parts(
    unit: Unit, sources_by_part: list[list[Source]], max_parts: int
) -> bool:
    """
    Log a unit that is split, and return whether it needs too many parts.

    Each part is a call of its own, so a unit that would need more than
    max_parts is skipped, which caps what one unit can cost.

    Args:
        unit (Unit): the unit
        sources_by_part (list of list of Source): its parts' sources, from
            pack_parts
        max_parts (int): the most parts the unit may be split into
    """
    if len(sources_by_part) <= 1:
        return False
    sources = [source for part in sources_by_part for source in part]
    details = (
        unit.kind,
        unit.external_id,
        unit.run.run_id,
        len(sources),
        sum(source.tokens for source in sources),
        len(sources_by_part),
    )
    if len(sources_by_part) > max_parts:
        logger.warning(
            "Skipping %s %s of run %s: %d files, about %d tokens, need %d"
            " parts, over the limit of %d",
            *details,
            max_parts,
        )
        return True
    logger.info(
        "Splitting %s %s of run %s: %d files, about %d tokens, into %d parts",
        *details,
    )
    return False


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
    ids as the unit's sources. A part is keyed by the key inputs, its position
    and its sources' ids and text, and not by the number of parts, so a part
    is reused when parts are added after it. The unit's id isn't in the key,
    so another run's unit with the same files reuses its parts the way it
    reuses an unsplit unit's row. Like that row, a part row is pointed at the
    unit that used it last: two units of a course with the same title, kind
    and part share the part's row.

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
    unit: Unit,
    *,
    sources_by_part: list[list[Source]],
    key_inputs: list,
    build_part_prompt: Callable[[int, list[Source]], str],
    merge: Callable[[list[ClaimExtraction], str], ClaimExtraction | None],
    finish_part: Callable[[dict], dict] | None = None,
    overwrite: bool = False,
) -> ClaimExtraction | None:
    """
    Extract each part of a split unit, then merge them into the unit's row.

    A part whose key changed gets a new row rather than replacing the unit's
    row for that part, and the unit's parts that aren't current are deleted
    only once the merge is stored, and only when no other unit's merge cites
    them: until then the unit's earlier merge cites them, so a part or merge
    call that fails, or a merge that is skipped, leaves that merge's parts as
    they were. A part regenerated with overwrite is the exception: its key is
    the same, so its row is replaced.

    Args:
        extractor (ClaimExtractor): the unit's extractor; parts are extracted
            with it at the unit_part level
        unit (Unit): the split unit
        sources_by_part (list of list of Source): each part's sources, from
            pack_parts
        key_inputs (list): what else the keys are built from, like the course
            and the unit's title
        build_part_prompt (callable): returns a part's prompt, given its index
            from 1 and its sources
        merge (callable): given the parts and the merge's cache key, stores
            the unit's merged extraction with merge_parts and returns it, or
            None when the merge is skipped
        finish_part (callable): passed to get_or_create_extraction for each part
        overwrite (bool): call the model for every part and the merge, even
            when stored

    Returns:
        ClaimExtraction | None: the unit's merged extraction, or None when
            the merge call would be over its token limit

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
    extraction = merge(
        part_extractions,
        extractor.key(
            "merge",
            *key_inputs,
            # a part regenerated with overwrite keeps its key but not its output
            [[part.key, part.output] for part in part_extractions],
        ),
    )
    if extraction is not None:
        delete_stale_parts(unit, keep=part_extractions)
    return extraction


def get_or_create_extraction(  # noqa: PLR0913
    extractor: ClaimExtractor,
    key: str,
    build_prompt: Callable[[], str],
    sources: list[Source] = (),
    *,
    unit: Unit | None = None,
    run: LearningResourceRun | None = None,
    part: int | None = None,
    finish: Callable[[dict], dict] | None = None,
    overwrite: bool = False,
) -> ClaimExtraction:
    """
    Return the extraction for a key, calling the model if there is none.

    Units with the same inputs share the key's row, which is pointed at the
    unit asking for it, so `unit` is the unit that used the row last. The
    unit's other rows at the extractor's level are no longer current and are
    deleted, leaving it one of each, except for parts: see _store_extraction.

    Args:
        extractor (ClaimExtractor): the extractor to call
        key (str): the call's cache key
        build_prompt (callable): returns the course material for the call,
            called only when the model is
        sources (list of Source): the sources in the prompt, to verify the
            output's evidence against
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
    if not overwrite:
        extraction = ClaimExtraction.objects.filter(key=key).first()
        if extraction:
            return _store_extraction(
                extraction, unit=unit, run=run, level=extractor.level, part=part
            )
    parsed, raw = call_llm(extractor, build_prompt())
    output = _stored_output(parsed.model_dump(), sources)
    if finish:
        output = finish(output)
    return _store_extraction(
        ClaimExtraction.objects.filter(key=key).first(),
        unit=unit,
        run=run,
        level=extractor.level,
        part=part,
        key=key,
        extractor_version=extractor.version,
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
    other extractions at the same level.

    A split unit has a row for each part and one for the whole unit, which
    merges them, so a unit's rows are told apart by level and part. A unit's
    part rows are neither reused for another key nor deleted here: the
    unit's merge cites them until a new merge is stored, and then
    delete_stale_parts deletes the ones that aren't current and that no other
    unit's merge cites.

    Args:
        extraction (ClaimExtraction | None): the row for the key, if there is
            one; otherwise the unit's or run's latest row at the level is
            reused for the key, except for a part, or a row is created
        unit (Unit | None): the unit the row is for, for a unit-level extraction
        run (LearningResourceRun | None): the run the row is for, for a
            run-level extraction; exactly one of unit and run is given
        level (str): the row's ClaimExtraction.Level
        part (int | None): the row's part, for a unit_part extraction
        fields: what else to set on the row
    """
    owner_field, owner = ("unit", unit) if unit is not None else ("run", run)
    scope = {owner_field: owner, "level": level, "part": part}
    is_part = level == ClaimExtraction.Level.UNIT_PART
    with transaction.atomic():
        rows = ClaimExtraction.objects.select_for_update().filter(**scope)
        if extraction is None and not is_part:
            extraction = rows.order_by("-updated_on", "-id").first()
        if extraction is None:
            extraction = ClaimExtraction.objects.create(**scope, **fields)
        else:
            if not is_part:
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
