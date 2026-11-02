"""
Shared parts of resource profile claim generation.

An extractor is one stage's prompt, output schema and configuration. Its
validated output is stored in ClaimExtraction under a key its caller builds
from the call's inputs, and a call whose key is already stored is skipped.
"""

import hashlib
import json
import logging
import types
from collections.abc import Callable
from dataclasses import dataclass
from functools import cached_property
from typing import Union, get_args, get_origin

from django.conf import settings
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_litellm import ChatLiteLLM
from pydantic import BaseModel, ValidationError

from learning_resources.models import (
    ClaimExtraction,
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
    """Return the sha256 of a call's inputs"""
    blob = json.dumps(inputs, ensure_ascii=False, separators=(",", ":"))
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


def load_extractor(stage: str, schema: type[BaseModel]) -> ClaimExtractor:
    """
    Build a stage's extractor from its ResourceProfileConfiguration.

    Args:
        stage (str): a ResourceProfileConfiguration.Stage
        schema (type of BaseModel): the extractor's output schema

    Raises:
        ClaimExtractionError: when the stage has no configuration
    """
    config = ResourceProfileConfiguration.objects.filter(stage=stage).first()
    if not config:
        msg = f"No ResourceProfileConfiguration for stage {stage}"
        raise ClaimExtractionError(msg)
    return ClaimExtractor(
        stage, ClaimExtraction.Level.UNIT, config.prompt, schema, config
    )


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
def _truncation_notes(sources: list[Source]) -> list[str]:
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
    output["extraction_notes"] += _truncation_notes(sources)
    output["sources"] = [source.summary() for source in sources]
    return output


# --------------------------------------------------------------------------- extraction
def over_budget(unit: Unit, sources: list[Source], budget: int) -> bool:
    """Log a unit whose files are over the input budget"""
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
    return True


def get_or_create_extraction(  # noqa: PLR0913
    extractor: ClaimExtractor,
    key: str,
    combined_prompt: Callable[[], str],
    sources: list[Source],
    *,
    unit: Unit,
    finish: Callable[[dict], dict] | None = None,
    overwrite: bool = False,
) -> ClaimExtraction:
    """
    Return the stored extraction for a key, calling the model if there is none.

    Args:
        extractor (ClaimExtractor): the extractor to call
        key (str): the call's cache key
        combined_prompt (callable): returns the course material for the call,
            called only when the model is
        sources (list of Source): the sources in the prompt, to verify the
            output's evidence against
        unit (Unit): the unit the call is for
        finish (callable): what else to do to the verified output, as plain
            data, before it is stored
        overwrite (bool): call the model even when the key is stored, and
            replace the stored extraction

    Raises:
        ClaimExtractionError: when the model gives no valid response
    """
    if not overwrite:
        extraction = ClaimExtraction.objects.filter(key=key).first()
        if extraction:
            return extraction
    parsed, raw = call_llm(extractor, combined_prompt())
    output = _stored_output(parsed.model_dump(), sources)
    if finish:
        output = finish(output)
    extraction, _ = ClaimExtraction.objects.update_or_create(
        key=key,
        defaults={
            "level": extractor.level,
            "extractor_version": extractor.version,
            "model": extractor.config.llm_model,
            "output": _sanitize(output),
            "raw_response": sanitize_llm_text(raw),
            "unit": unit,
        },
    )
    return extraction
