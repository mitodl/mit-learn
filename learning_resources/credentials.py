"""
Generate Open Badges credential metadata for a learning resource.

Each request assembles one context -- resource metadata, the scraped marketing
page, and the highest-scoring content-file chunks for the resource -- then fans
out one LLM call per credential field over it. There is no agent because there
is nothing for a model to decide: the retrieval query is fixed, so retrieval is
a deterministic call in our own code rather than a tool.

Nothing here is cached. An author who dislikes a draft asks again and gets a
new one; every call appends a CredentialMetadataGeneration row instead.
"""

import asyncio
import logging
import time
from typing import Annotated, NamedTuple

import litellm
from django.conf import settings
from langchain_litellm import ChatLiteLLM
from typing_extensions import TypedDict

from learning_resources.constants import CredentialMetadataField
from learning_resources.etl.constants import MARKETING_PAGE_FILE_TYPE
from learning_resources.models import (
    ContentFile,
    CredentialMetadataConfiguration,
    CredentialMetadataGeneration,
    LearningResource,
)
from learning_resources.utils import (
    count_tokens,
    sanitize_llm_text,
    truncate_to_tokens,
)
from main.utils import db_sync_to_async
from vector_search.utils import async_content_file_chunks_for_resource

logger = logging.getLogger(__name__)

# drop unsupported model params
litellm.drop_params = True


class BadgeDescription(TypedDict):
    """Structured response for the Open Badges description field"""

    description: Annotated[
        str, ..., "The Open Badges 3.0 description of the credential, 1-2 sentences"
    ]


class BadgeCriteria(TypedDict):
    """Structured response for the Open Badges criteria field"""

    skills: Annotated[
        list[str],
        ...,
        "Skill-focused criteria bullets, one skill the learner demonstrated per item",
    ]


class LearningGoals(TypedDict):
    """Structured response for the learning goals field"""

    goals: Annotated[
        list[str],
        ...,
        "Learning goals: the skills, knowledge and abilities gained on completion",
    ]


RESPONSE_SCHEMAS = {
    CredentialMetadataField.description.name: BadgeDescription,
    CredentialMetadataField.criteria.name: BadgeCriteria,
    CredentialMetadataField.learning_goals.name: LearningGoals,
}

# Sections of the marketing page below this heading -- instructor CVs and
# publication lists, then the site footer -- are about a third of the page and
# say nothing about skills gained.
MARKETING_PAGE_CUT_HEADING = "## meet your instructors"

# Left as-is, a prerequisites section is read as an outcome: the model reported
# prerequisite mathematics as a skill the learner gained.
MARKETING_PAGE_PREREQUISITES_HEADING = "## prerequisites"
MARKETING_PAGE_PREREQUISITES_REPLACEMENT = (
    "## Prerequisites (what a learner must already know BEFORE starting."
    " These are entry requirements, NOT skills gained or outcomes.)"
)

# The resource url is deliberately absent: with it in context the model
# fabricated `#criteria-N` URIs off whatever host the url pointed at.
METADATA_FIELDS = (
    "title",
    "readable_id",
    "description",
    "resource_type",
    "certification_type",
    "platform",
    "offered_by",
    "departments",
    "topics",
    "level",
)

# Structure markup and duplicate transcript formats: never prose, and they
# crowd out chunks that are.
EXCLUDED_CHUNK_EXTENSIONS = frozenset({".xml", ".sjson", ".json"})


class CredentialContext(NamedTuple):
    """
    The assembled sources for one resource, before any per-field budget applies.

    Kept as separate sections rather than one string because each field has its
    own token budget: a 1-2 sentence description is diluted by a large context
    while criteria and learning goals benefit from one.
    """

    metadata: str
    marketing_page: str
    chunks: list[tuple[str, str]]

    def assemble(self, max_tokens: int, llm_model: str) -> tuple[str, list[str]]:
        """
        Render the context into a single string within a token budget.

        Metadata always survives. The marketing page is truncated to whatever
        remains, then chunks are added highest-scoring first, each only if it
        fits -- a later, smaller chunk can still make it in.

        Returns:
            tuple[str, list[str]]: the context text, and the Qdrant point ids
                of the chunks that made it in
        """
        sections = [self.metadata]
        remaining = max_tokens - count_tokens(self.metadata, llm_model)

        if self.marketing_page and remaining > 0:
            page = truncate_to_tokens(self.marketing_page, remaining, llm_model)
            sections.append(page)
            remaining -= count_tokens(page, llm_model)

        point_ids = []
        for point_id, text in self.chunks:
            if remaining <= 0:
                break
            tokens = count_tokens(text, llm_model)
            if tokens <= remaining:
                sections.append(text)
                point_ids.append(point_id)
                remaining -= tokens

        text = "\n\n".join(section for section in sections if section)
        # Backstop: the section joins and headings are themselves tokens.
        return truncate_to_tokens(text, max_tokens, llm_model), point_ids


def _render_metadata(resource: LearningResource) -> str:
    """Render the resource's own fields as a markdown block."""
    best_run = resource.best_run
    values = {
        "title": resource.title,
        "readable_id": resource.readable_id,
        "description": resource.description or "",
        "resource_type": resource.resource_type,
        "certification_type": resource.certification_type,
        "platform": resource.platform.name if resource.platform else "",
        "offered_by": resource.offered_by.name if resource.offered_by else "",
        "departments": ", ".join(
            department.name for department in resource.departments.all()
        ),
        "topics": ", ".join(topic.name for topic in resource.topics.all()),
        "level": ", ".join(best_run.level) if best_run and best_run.level else "",
    }
    lines = [
        f"- {field.replace('_', ' ').title()}: {values[field]}"
        for field in METADATA_FIELDS
        if values[field]
    ]
    return "## Course information\n" + "\n".join(lines)


def _prepare_marketing_page(content: str) -> str:
    """
    Cut the marketing page down to the part that bears on skills gained.

    Headings are matched case-insensitively on their own line, because they come
    from whatever the page's h2s happened to say.
    """
    kept = []
    for line in content.splitlines():
        heading = line.strip().lower()
        if heading.startswith(MARKETING_PAGE_CUT_HEADING):
            break
        if heading.startswith(MARKETING_PAGE_PREREQUISITES_HEADING):
            kept.append(MARKETING_PAGE_PREREQUISITES_REPLACEMENT)
            continue
        kept.append(line)
    page = "\n".join(kept).strip()
    return f"## Marketing page\n\n{page}" if page else ""


def _marketing_page_content(resource: LearningResource) -> str:
    """Return the resource's marketing page content, or an empty string."""
    return (
        ContentFile.objects.filter(
            learning_resource=resource,
            file_type=MARKETING_PAGE_FILE_TYPE,
            published=True,
        )
        .exclude(content="")
        .exclude(content__isnull=True)
        .values_list("content", flat=True)
        .first()
        or ""
    )


def _render_chunk(chunk: dict) -> str:
    """Render one retrieved content-file chunk with what identifies it."""
    title = chunk.get("title") or chunk.get("key") or ""
    header = f"### Course content: {title}" if title else "### Course content"
    return f"{header}\n\n{chunk['chunk_content'].strip()}"


def _usable_chunks(chunks: list[dict]) -> list[tuple[str, str]]:
    """Filter retrieved chunks down to prose worth spending context on."""
    usable = []
    for chunk in chunks:
        content = (chunk.get("chunk_content") or "").strip()
        if len(content) < settings.CREDENTIAL_METADATA_MIN_CHUNK_CHARS:
            # Near-empty OLX stub blocks are common (`prerequisites` runs 4
            # characters) and would only displace real content.
            continue
        if chunk.get("file_extension") in EXCLUDED_CHUNK_EXTENSIONS:
            continue
        if chunk.get("file_type") == MARKETING_PAGE_FILE_TYPE:
            # Already included in full, ahead of any budget for chunks.
            continue
        usable.append((chunk["point_id"], _render_chunk(chunk)))
    return usable


async def _retrieve_chunks(resource: LearningResource) -> list[tuple[str, str]]:
    """
    Retrieve the resource's most relevant content-file chunks.

    Retrieval is best-effort: metadata plus the marketing page is a viable
    degraded context, so a Qdrant outage returns a thinner draft rather than an
    error. CREDENTIAL_METADATA_RETRIEVAL_ENABLED turns it off outright.
    """
    if not settings.CREDENTIAL_METADATA_RETRIEVAL_ENABLED:
        return []
    try:
        chunks = await async_content_file_chunks_for_resource(
            resource.readable_id,
            settings.CREDENTIAL_METADATA_RETRIEVAL_QUERY,
            limit=settings.CREDENTIAL_METADATA_RETRIEVAL_LIMIT,
        )
    except Exception:
        logger.exception(
            "Content file retrieval failed for %s; generating from metadata"
            " and marketing page alone",
            resource.readable_id,
        )
        return []
    return _usable_chunks(chunks)


async def build_credential_context(resource: LearningResource) -> CredentialContext:
    """
    Assemble every source for a resource's credential metadata.

    Args:
        resource (LearningResource): the resource to build context for

    Returns:
        CredentialContext: the metadata, marketing page and retrieved chunks
    """
    metadata, marketing_page, chunks = await asyncio.gather(
        db_sync_to_async(_render_metadata)(resource),
        db_sync_to_async(_marketing_page_content)(resource),
        _retrieve_chunks(resource),
    )
    return CredentialContext(
        metadata=metadata,
        marketing_page=_prepare_marketing_page(marketing_page),
        chunks=chunks,
    )


def _get_llm(config: CredentialMetadataConfiguration) -> ChatLiteLLM:
    """Get the ChatLiteLLM instance for a field's configuration"""
    if not settings.OPENAI_API_KEY:
        raise ValueError("The 'OPENAI_API_KEY' setting must be set.")  # noqa: EM101, TRY003

    if not settings.LITELLM_CUSTOM_PROVIDER:
        raise ValueError("The 'LITELLM_CUSTOM_PROVIDER' setting must be set.")  # noqa: EM101, TRY003

    return ChatLiteLLM(
        model=config.llm_model,
        temperature=config.temperature,
        max_tokens=config.max_output_tokens,
        custom_llm_provider=settings.LITELLM_CUSTOM_PROVIDER,
        api_base=settings.LITELLM_API_BASE,
    )


def _sanitize(value):
    """Strip characters Postgres can't store, at any depth of the response."""
    if isinstance(value, str):
        return sanitize_llm_text(value)
    if isinstance(value, list):
        return [_sanitize(item) for item in value]
    if isinstance(value, dict):
        return {key: _sanitize(item) for key, item in value.items()}
    return value


async def _generate_field(
    resource: LearningResource,
    config: CredentialMetadataConfiguration,
    context: CredentialContext,
    user=None,
) -> dict | None:
    """
    Generate one credential metadata field and log the attempt.

    A CredentialMetadataGeneration row is written whether or not the call
    succeeds -- a failure is exactly the case the log exists to explain.

    Returns:
        dict | None: the structured response, or None if generation failed
    """
    context_text, point_ids = context.assemble(
        config.max_context_tokens, config.llm_model
    )
    prompt = f"{context_text}\n\n{config.prompt}"

    response, error = None, ""
    started = time.monotonic()
    try:
        llm = _get_llm(config).with_structured_output(RESPONSE_SCHEMAS[config.field])
        response = _sanitize(await llm.ainvoke(prompt))
    except Exception as exc:
        logger.exception(
            "Credential metadata generation failed for %s field %s",
            resource.readable_id,
            config.field,
        )
        error = str(exc)
    latency_ms = int((time.monotonic() - started) * 1000)

    await db_sync_to_async(CredentialMetadataGeneration.objects.create)(
        learning_resource=resource,
        field=config.field,
        response=response,
        error=error,
        prompt_text=config.prompt,
        llm_model=config.llm_model,
        temperature=config.temperature,
        context_text=sanitize_llm_text(context_text),
        context_tokens=count_tokens(context_text, config.llm_model),
        retrieved_point_ids=point_ids,
        latency_ms=latency_ms,
        generated_by=user,
    )
    return response


def render_criteria_narrative(skills: list[str]) -> str:
    """
    Render the Open Badges criteria narrative from discrete skills.

    Kept in Python so the model never touches the Open Badges schema and never
    mints identifiers -- asked for criteria directly it invented both.
    """
    return "\n".join(f"- {skill}" for skill in skills)


async def generate_credential_metadata(resource: LearningResource, user=None) -> dict:
    """
    Generate every configured credential metadata field for a resource.

    The fields share one context and are independent, so they are generated
    concurrently: three sequential calls take about as long as the sum of
    their output lengths, three concurrent ones about as long as the slowest.

    Args:
        resource (LearningResource): the resource to generate metadata for
        user (User): the user the generation is logged against

    Returns:
        dict: description (str), criteria (rendered narrative), criteria_skills
            (list[str]) and learning_goals (list[str]). A field whose
            generation failed, or which has no active configuration, is absent.
    """
    configs = await db_sync_to_async(
        lambda: list(CredentialMetadataConfiguration.objects.filter(is_active=True))
    )()
    if not configs:
        logger.warning(
            "No active CredentialMetadataConfiguration; nothing to generate for %s",
            resource.readable_id,
        )
        return {}

    context = await build_credential_context(resource)
    responses = await asyncio.gather(
        *[_generate_field(resource, config, context, user=user) for config in configs]
    )

    # An empty value is left out entirely, like a failure: a caller
    # prepopulating a field must not overwrite a good value with a blank one,
    # and a field a human fills in beats a fabrication they rubber-stamp.
    metadata = {}
    for config, response in zip(configs, responses):
        if not response:
            continue
        if config.field == CredentialMetadataField.description.name:
            if response.get("description"):
                metadata["description"] = response["description"]
        elif config.field == CredentialMetadataField.criteria.name:
            skills = [skill for skill in response.get("skills") or [] if skill]
            if skills:
                metadata["criteria"] = render_criteria_narrative(skills)
                metadata["criteria_skills"] = skills
        elif config.field == CredentialMetadataField.learning_goals.name:
            goals = [goal for goal in response.get("goals") or [] if goal]
            if goals:
                metadata["learning_goals"] = goals
    return metadata
