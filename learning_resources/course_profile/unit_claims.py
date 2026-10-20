"""
Step 1 of course profile generation: claims for each unit of a run.

The context unit is extracted first, because every other unit's prompt
includes a digest of it. Then each unit and bin gets one call for its files.
A unit whose files are over the input budget is skipped and logged. Every
call's validated output is stored in ClaimExtraction under a key built
from its inputs, and a call whose key is already stored is skipped.
"""

import hashlib
import json
import logging
from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass
from functools import cached_property, partial

from django.conf import settings
from django.db.models import F
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_litellm import ChatLiteLLM
from pydantic import BaseModel

from learning_resources.course_profile import prompts
from learning_resources.course_profile.schemas import CourseContextOut, UnitExtraction
from learning_resources.course_profile.sources import Source, unit_sources
from learning_resources.course_profile.verification import verify_all_evidence
from learning_resources.models import (
    ClaimExtraction,
    CourseProfileConfiguration,
    LearningResourceRun,
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


@dataclass(frozen=True)
class Stages:
    """The configured stages of step 1"""

    context: PromptStage
    unit: PromptStage


def load_stages() -> Stages:
    """
    Build the step 1 stages from CourseProfileConfiguration.

    Raises:
        ClaimExtractionError: when a stage has no configuration
    """
    configs = {
        config.stage: config for config in CourseProfileConfiguration.objects.all()
    }
    missing = sorted(set(CourseProfileConfiguration.Stage.values) - configs.keys())
    if missing:
        msg = f"No CourseProfileConfiguration for stage(s) {', '.join(missing)}"
        raise ClaimExtractionError(msg)
    context_config = configs[CourseProfileConfiguration.Stage.CONTEXT]
    unit_config = configs[CourseProfileConfiguration.Stage.UNIT]
    return Stages(
        context=PromptStage(
            "context",
            ClaimExtraction.Level.UNIT,
            context_config.prompt,
            CourseContextOut,
            context_config,
        ),
        unit=PromptStage(
            "unit",
            ClaimExtraction.Level.UNIT,
            unit_config.prompt,
            UnitExtraction,
            unit_config,
        ),
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


def _unit_header(unit: Unit) -> str:
    lines = [f"title={unit.title!r} | kind={unit.kind}"]
    if unit.kind == Unit.Kind.BIN:
        lines.append(
            "These files are not part of a course unit. They are grouped by where"
            " the course links them or by type, and their order is not meaningful."
        )
    return "\n".join(lines)


def _blocks(sources: list[Source]) -> str:
    return "\n".join(source.block for source in sources)


def _source_tokens(sources: list[Source]) -> int:
    return sum(source.tokens for source in sources)


# --------------------------------------------------------------------------- extraction
@dataclass(frozen=True)
class CourseContext:
    """What every unit prompt of a run is given about the course"""

    # the context unit's extraction key, empty when the run has no context
    key: str
    digest: str
    course_title: str


class UnitClaimsGenerator:
    """Generates and caches the step 1 claims for one run"""

    def __init__(self, run: LearningResourceRun, stages: Stages | None = None):
        self.run = run
        self.stages = stages or load_stages()
        self.stats = Counter()

    def _cached_or_call(
        self,
        stage: PromptStage,
        key: str,
        combined_prompt: str,
        finish: Callable[[dict], dict],
        unit: Unit,
    ) -> ClaimExtraction:
        """
        Return the stored extraction for a key, calling the model if there is none.

        Args:
            stage (PromptStage): the stage to call
            key (str): the call's cache key
            combined_prompt (str): the course material for the call
            finish (callable): turns the model's validated output, as plain
                data, into what is stored
            unit (Unit): the unit the call is for
        """
        extraction = ClaimExtraction.objects.filter(key=key).first()
        if extraction:
            self.stats["cached"] += 1
            return extraction
        parsed, raw = call_llm(stage, combined_prompt)
        self.stats["generated"] += 1
        extraction, _ = ClaimExtraction.objects.get_or_create(
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

    def extract_context(self) -> CourseContext:
        """
        Extract the run's context unit.

        A run with no context unit, one with no text, or one whose files are
        over the input budget still gets a digest, from the course title alone.
        """
        stage = self.stages.context
        course_title = self.run.learning_resource.title
        no_context = CourseContext(
            "", f"Title: {course_title}\nNo course context is available.", course_title
        )
        unit = self.run.units.filter(kind=Unit.Kind.CONTEXT).first()
        sources = unit_sources(unit, stage.config.max_file_tokens) if unit else []
        if not sources:
            return no_context
        if self._over_budget(unit, sources, stage.config.input_token_budget):
            return no_context
        key = stage.key(
            [source.cache_input() for source in sources],
            unit.title,
            unit.kind,
            course_title,
            stage.config.max_file_tokens,
        )
        extraction = self._cached_or_call(
            stage,
            key,
            prompts.context_unit_combined_prompt(course_title, _blocks(sources)),
            partial(_context_output, sources=sources),
            unit,
        )
        return CourseContext(
            extraction.key, context_digest(extraction.output), course_title
        )

    def _over_budget(self, unit: Unit, sources: list[Source], budget: int) -> bool:
        """Log and count a unit whose files are over the input budget"""
        tokens = _source_tokens(sources)
        if tokens <= budget:
            return False
        logger.warning(
            "Skipping %s %s of run %s: %d files, about %d tokens, over the"
            " input budget of %d",
            unit.kind,
            unit.external_id,
            self.run.run_id,
            len(sources),
            tokens,
            budget,
        )
        self.stats["over_budget"] += 1
        return True

    def extract_unit(
        self, unit: Unit, context: CourseContext
    ) -> ClaimExtraction | None:
        """
        Extract one unit or bin.

        Returns:
            ClaimExtraction | None: the unit's extraction, or None when the
                unit has no files with text or is over the input budget
        """
        stage = self.stages.unit
        config = stage.config
        sources = unit_sources(unit, config.max_file_tokens)
        if not sources:
            self.stats["skipped"] += 1
            return None
        if self._over_budget(unit, sources, config.input_token_budget):
            return None
        return self._cached_or_call(
            stage,
            stage.key(
                [source.cache_input() for source in sources],
                unit.title,
                unit.kind,
                context.key,
                context.course_title,
                config.max_file_tokens,
            ),
            prompts.unit_combined_prompt(
                context.digest, _unit_header(unit), _blocks(sources)
            ),
            partial(_unit_output, sources=sources),
            unit,
        )

    def generate(self) -> dict:
        """
        Extract the run's context unit, then each of its units and bins.

        A unit that fails is logged and skipped, so one bad response doesn't
        cost the rest of the run; running again retries only what failed. A
        failed context unit stops the run, because every unit's key and prompt
        depend on it.

        Returns:
            dict: counts of units extracted, skipped (no text), over_budget
                (context included) and failed, and of model calls made and
                cache hits
        """
        context = self.extract_context()
        units = self.run.units.exclude(kind=Unit.Kind.CONTEXT).order_by(
            F("position").asc(nulls_last=True), "external_id"
        )
        for unit in units:
            try:
                extraction = self.extract_unit(unit, context)
            except Exception:
                logger.exception(
                    "Unit claim extraction failed for unit %s of run %s",
                    unit.external_id,
                    self.run.run_id,
                )
                self.stats["failed"] += 1
                continue
            if extraction:
                self.stats["extracted"] += 1
        return dict(self.stats)


def generate_unit_claims(run: LearningResourceRun) -> dict:
    """
    Generate the claims for every unit, bin and context unit of a run.

    Args:
        run (LearningResourceRun): the run, normally its course's best run

    Returns:
        dict: see UnitClaimsGenerator.generate
    """
    return UnitClaimsGenerator(run).generate()
