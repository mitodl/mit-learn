"""
Step 1 of course profile generation: claims for one unit.

A unit's files are sent to the model in one call, and its validated output is
stored in ClaimExtraction under a key built from the call's inputs. A call
whose key is already stored is skipped, so a unit whose files haven't changed
is never sent twice, even from another run of the course.
"""

import hashlib
import json
import logging
from dataclasses import dataclass
from functools import cached_property

from django.conf import settings
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_litellm import ChatLiteLLM
from pydantic import BaseModel

from learning_resources.course_profile import prompts
from learning_resources.course_profile.schemas import UnitExtraction
from learning_resources.course_profile.sources import Source, unit_sources
from learning_resources.course_profile.verification import verify_all_evidence
from learning_resources.models import (
    ClaimExtraction,
    CourseProfileConfiguration,
    Unit,
)
from learning_resources.utils import sanitize_llm_text

logger = logging.getLogger(__name__)

# claim lists in a unit output, and the prefix of their claim ids
CLAIM_PREFIXES = {
    "concepts": "c",
    "skills": "s",
    "assumed_knowledge": "a",
    "assessment_expectations": "t",
}


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
    config: CourseProfileConfiguration

    @cached_property
    def version(self) -> str:
        """The stage name and a hash of its prompt and output schema"""
        digest = cache_key(self.system, self.schema.model_json_schema())
        return f"{self.name}-{digest[:12]}"

    def key(self, *inputs) -> str:
        """Return the cache key for a call of this stage with these inputs"""
        return cache_key(
            self.level,
            *inputs,
            self.version,
            self.config.llm_model,
            self.config.temperature,
        )


def load_unit_stage() -> PromptStage:
    """
    Build the unit stage from its CourseProfileConfiguration.

    Raises:
        ClaimExtractionError: when the unit stage has no configuration
    """
    config = CourseProfileConfiguration.objects.filter(
        stage=CourseProfileConfiguration.Stage.UNIT
    ).first()
    if not config:
        msg = "No CourseProfileConfiguration for stage unit"
        raise ClaimExtractionError(msg)
    return PromptStage(
        "unit", ClaimExtraction.Level.UNIT, config.prompt, UnitExtraction, config
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


def call_llm(stage: PromptStage, combined_prompt: str) -> tuple[BaseModel, str]:
    """
    Ask the model for a stage's structured output.

    A response that doesn't validate against the stage's schema is requested
    again, up to COURSE_PROFILE_LLM_ATTEMPTS times in all.

    Returns:
        tuple of (BaseModel, str): the validated output, and the response
            as the model returned it

    Raises:
        ClaimExtractionError: when no response validates
    """
    llm = ChatLiteLLM(
        model=stage.config.llm_model,
        temperature=stage.config.temperature,
        max_tokens=stage.config.max_output_tokens,
        api_base=settings.LITELLM_API_BASE,
        request_timeout=settings.COURSE_PROFILE_LLM_TIMEOUT,
        # Tool calling, not the default json_schema: OpenAI's strict json_schema
        # mode rejects optional fields, and pydantic validates the response anyway.
    ).with_structured_output(stage.schema, method="function_calling", include_raw=True)
    messages = [
        SystemMessage(content=stage.system),
        HumanMessage(content=combined_prompt),
    ]
    error = None
    for _ in range(settings.COURSE_PROFILE_LLM_ATTEMPTS):
        result = llm.invoke(messages)
        if result["parsed"] is not None:
            return result["parsed"], _raw_response(result["raw"])
        error = result["parsing_error"]
    msg = (
        f"{stage.name}: no valid {stage.schema.__name__} after"
        f" {settings.COURSE_PROFILE_LLM_ATTEMPTS} attempt(s): {error}"
    )
    raise ClaimExtractionError(msg)


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


def _course_digest(unit: Unit) -> str:
    """Describe the course to the unit prompt"""
    return f"Title: {unit.run.learning_resource.title}"


# --------------------------------------------------------------------------- extraction
def generate_unit_claims(
    unit: Unit, stage: PromptStage | None = None
) -> ClaimExtraction | None:
    """
    Generate the claims for one unit or bin, or return the stored ones.

    Args:
        unit (Unit): the unit or bin
        stage (PromptStage): the unit stage, loaded from its configuration
            when not given

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
        return None
    tokens = sum(source.tokens for source in sources)
    if tokens > config.input_token_budget:
        logger.warning(
            "Skipping %s %s of run %s: %d files, about %d tokens, over the"
            " input budget of %d",
            unit.kind,
            unit.external_id,
            unit.run.run_id,
            len(sources),
            tokens,
            config.input_token_budget,
        )
        return None
    course_digest = _course_digest(unit)
    key = stage.key(
        [source.cache_input() for source in sources],
        unit.title,
        unit.kind,
        course_digest,
        config.max_file_tokens,
    )
    extraction = ClaimExtraction.objects.filter(key=key).first()
    if extraction:
        return extraction
    parsed, raw = call_llm(
        stage,
        prompts.unit_combined_prompt(
            course_digest,
            _unit_header(unit),
            "\n".join(source.block for source in sources),
        ),
    )
    extraction, _ = ClaimExtraction.objects.get_or_create(
        key=key,
        defaults={
            "level": stage.level,
            "extractor_version": stage.version,
            "model": config.llm_model,
            "output": _sanitize(_unit_output(parsed.model_dump(), sources)),
            "raw_response": sanitize_llm_text(raw),
            "unit": unit,
        },
    )
    return extraction
