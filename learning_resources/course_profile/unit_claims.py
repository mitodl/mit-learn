"""
Step 1 of course profile generation: claims for each unit of a run.

The context unit is extracted first, because every other unit's prompt
includes a digest of it. Then each unit and bin gets one call for its files,
or, when they are over the input budget, one call per part and a merge call.
Every call's validated output is stored in ClaimExtraction under a key built
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
from learning_resources.course_profile.schemas import (
    CourseContextOut,
    UnitExtraction,
    UnitMergeOut,
)
from learning_resources.course_profile.sources import Source, pack, unit_sources
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
# weakest first
TEACHING_STATUSES = ["mentioned", "used", "reviewed", "taught"]


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
    unit_part: PromptStage
    unit_merge: PromptStage


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
    merge_config = configs[CourseProfileConfiguration.Stage.UNIT_MERGE]
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
        unit_part=PromptStage(
            "unit_part",
            ClaimExtraction.Level.UNIT_PART,
            unit_config.prompt + prompts.UNIT_PART_NOTE,
            UnitExtraction,
            unit_config,
        ),
        unit_merge=PromptStage(
            "unit_merge",
            ClaimExtraction.Level.UNIT,
            merge_config.prompt,
            UnitMergeOut,
            merge_config,
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


def call_llm(stage: PromptStage, user: str) -> tuple[BaseModel, str]:
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
    ).with_structured_output(stage.schema, include_raw=True)
    messages = [SystemMessage(content=stage.system), HumanMessage(content=user)]
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


def _unit_output(parsed: dict, sources: list[Source], *, whole_unit: bool) -> dict:
    """
    Verify a unit or unit part output's evidence against its sources.

    Truncated files are listed in the extraction notes of a whole unit only,
    so a split unit's merge doesn't list them once per part.
    """
    output = _number_claims(
        verify_all_evidence(
            parsed, {source.source_id: source.text for source in sources}
        )
    )
    if whole_unit:
        output["extraction_notes"] += _truncation_notes(sources)
    output["sources"] = [source.summary() for source in sources]
    return output


def _context_output(parsed: dict, sources: list[Source], omitted: list[Source]) -> dict:
    """Verify a context output's evidence and note what wasn't read"""
    output = verify_all_evidence(
        parsed, {source.source_id: source.text for source in sources}
    )
    output["notes"] += _truncation_notes(sources)
    if omitted:
        output["notes"].append(
            f"{len(omitted)} context file(s) over the input budget were not read: "
            + ", ".join(source.source_id for source in omitted)
        )
    output["sources"] = [source.summary() for source in sources + omitted]
    return output


def _strongest_status(*statuses: str) -> str:
    return max(statuses, key=TEACHING_STATUSES.index)


def _merge_output(
    parsed: dict, parts: list[ClaimExtraction], sources: list[Source]
) -> dict:
    """
    Resolve a merge output's part claim ids into the evidence they carry.

    The result has the same shape as a unit that fit in one call. Ids that
    match no part claim are dropped, and so is a merged claim left with none.
    A concept's status is never weaker than the part claims it merges.
    """
    part_claims = {
        f"P{number}:{claim['id']}": claim
        for number, part in enumerate(parts, 1)
        for key in CLAIM_PREFIXES
        for claim in part.output[key]
    }
    output = dict(parsed)
    dropped = 0
    for key in CLAIM_PREFIXES:
        merged = []
        for claim in parsed[key]:
            claim_ids = [cid for cid in claim["part_claim_ids"] if cid in part_claims]
            if not claim_ids:
                dropped += 1
                continue
            cited = [part_claims[cid] for cid in claim_ids]
            evidence = list(
                {
                    (item["source_id"], item["passage"]): item
                    for part_claim in cited
                    for item in part_claim["evidence"]
                }.values()
            )
            claim = {**claim, "part_claim_ids": claim_ids, "evidence": evidence}  # noqa: PLW2901
            if key == "concepts":
                claim["teaching_status"] = _strongest_status(
                    claim["teaching_status"],
                    *(c["teaching_status"] for c in cited if "teaching_status" in c),
                )
            merged.append(claim)
        output[key] = merged
    output = _number_claims(output)
    if dropped:
        output["extraction_notes"].append(
            f"{dropped} merged claim(s) cited no part claim and were dropped"
        )
    output["extraction_notes"] += _truncation_notes(sources)
    output["sources"] = [source.summary() for source in sources]
    output["part_keys"] = [part.key for part in parts]
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


def parts_digest(parts: list[ClaimExtraction]) -> str:
    """List the claims of a split unit's parts for the merge prompt"""
    sections = (
        ("concepts", "Concepts"),
        ("skills", "Skills"),
        ("assumed_knowledge", "Assumed knowledge"),
        ("assessment_expectations", "Assessment expectations"),
    )
    lines = []
    for number, part in enumerate(parts, 1):
        output = part.output
        lines.append(f"## Part {number}\nSummary: {output['summary']}")
        for key, title in sections:
            if not output[key]:
                continue
            lines.append(f"{title}:")
            for claim in output[key]:
                status = (
                    f" [{claim['teaching_status']}]"
                    if "teaching_status" in claim
                    else ""
                )
                extra = ""
                if key == "assumed_knowledge":
                    extra = (
                        f" | used: {claim['how_used']}"
                        f" | flagged_as_prior={claim['flagged_as_prior']}"
                    )
                elif key == "assessment_expectations":
                    extra = " | tests: " + ", ".join(claim["tests_concept_labels"])
                lines.append(
                    f"- [P{number}:{claim['id']}]{status} {claim['label']}:"
                    f" {claim['description']}{extra}"
                )
        if output["extraction_notes"]:
            lines.append("Notes: " + " | ".join(output["extraction_notes"]))
    return "\n".join(lines)


def _unit_header(unit: Unit, part: int | None = None) -> str:
    lines = [f"title={unit.title!r} | kind={unit.kind}"]
    if unit.kind == Unit.Kind.BIN:
        lines.append(
            "These files are not part of a course unit. They are grouped by where"
            " the course links them or by type, and their order is not meaningful."
        )
    if part is not None:
        lines.append(
            f"This is part {part + 1} of the unit; the other parts are read separately."
        )
    return "\n".join(lines)


def _blocks(sources: list[Source]) -> str:
    return "\n".join(source.block for source in sources)


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

    def _cached_or_call(  # noqa: PLR0913
        self,
        stage: PromptStage,
        key: str,
        user: str,
        finish: Callable[[dict], dict],
        *,
        unit: Unit,
        part: int | None = None,
    ) -> ClaimExtraction:
        """
        Return the stored extraction for a key, calling the model if there is none.

        Args:
            stage (PromptStage): the stage to call
            key (str): the call's cache key
            user (str): the user prompt
            finish (callable): turns the model's validated output, as plain
                data, into what is stored
            unit (Unit): the unit the call is for
            part (int): the part index, for a unit part
        """
        extraction = ClaimExtraction.objects.filter(key=key).first()
        if extraction:
            self.stats["cached"] += 1
            return extraction
        parsed, raw = call_llm(stage, user)
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
                "part": part,
            },
        )
        return extraction

    def extract_context(self) -> CourseContext:
        """
        Extract the run's context unit.

        A run with no context unit, or one with no text, still gets a digest,
        from the course title alone. Context files over the input budget are
        left out and noted: there is no merge for context.
        """
        stage = self.stages.context
        course_title = self.run.learning_resource.title
        unit = self.run.units.filter(kind=Unit.Kind.CONTEXT).first()
        sources = unit_sources(unit, stage.config.max_file_tokens) if unit else []
        if not sources:
            return CourseContext(
                "",
                f"Title: {course_title}\nNo course context is available.",
                course_title,
            )
        included, *rest = pack(sources, stage.config.input_token_budget)
        omitted = [source for part in rest for source in part]
        key = stage.key(
            [source.cache_input() for source in included],
            [source.checksum for source in omitted],
            unit.title,
            unit.kind,
            course_title,
            stage.config.max_file_tokens,
        )
        extraction = self._cached_or_call(
            stage,
            key,
            prompts.context_user(course_title, _blocks(included)),
            partial(_context_output, sources=included, omitted=omitted),
            unit=unit,
        )
        return CourseContext(
            extraction.key, context_digest(extraction.output), course_title
        )

    def extract_unit(
        self, unit: Unit, context: CourseContext
    ) -> ClaimExtraction | None:
        """
        Extract one unit or bin, splitting it into parts if it is too large.

        Returns:
            ClaimExtraction | None: the unit-level extraction, or None when the
                unit has no files with text
        """
        config = self.stages.unit.config
        sources = unit_sources(unit, config.max_file_tokens)
        if not sources:
            return None
        common = [
            unit.title,
            unit.kind,
            context.key,
            context.course_title,
            config.max_file_tokens,
        ]
        parts = pack(sources, config.input_token_budget)
        if len(parts) == 1:
            stage = self.stages.unit
            return self._cached_or_call(
                stage,
                stage.key([source.cache_input() for source in sources], *common),
                prompts.unit_user(context.digest, _unit_header(unit), _blocks(sources)),
                partial(_unit_output, sources=sources, whole_unit=True),
                unit=unit,
            )
        stage = self.stages.unit_part
        part_extractions = [
            self._cached_or_call(
                stage,
                stage.key(
                    [source.cache_input() for source in part_sources], index, *common
                ),
                prompts.unit_user(
                    context.digest, _unit_header(unit, index), _blocks(part_sources)
                ),
                partial(_unit_output, sources=part_sources, whole_unit=False),
                unit=unit,
                part=index,
            )
            for index, part_sources in enumerate(parts)
        ]
        stage = self.stages.unit_merge
        return self._cached_or_call(
            stage,
            stage.key([part.key for part in part_extractions], unit.title, unit.kind),
            prompts.unit_merge_user(
                context.digest, _unit_header(unit), parts_digest(part_extractions)
            ),
            partial(_merge_output, parts=part_extractions, sources=sources),
            unit=unit,
        )

    def generate(self) -> dict:
        """
        Extract the run's context unit, then each of its units and bins.

        A unit that fails is logged and skipped, so one bad response doesn't
        cost the rest of the run; running again retries only what failed. A
        failed context unit stops the run, because every unit's key and prompt
        depend on it.

        Returns:
            dict: counts of units extracted, skipped (no text) and failed, and
                of model calls made and cache hits
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
            self.stats["extracted" if extraction else "skipped"] += 1
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
