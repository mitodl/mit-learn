"""
Generate Open Badges credential metadata for a learning resource.

Each request assembles one context -- resource metadata, the scraped marketing
page, and the highest-scoring content-file chunks for the resource -- then fans
out one LLM call per credential field over it. There is no agent because there
is nothing for a model to decide: the retrieval query is fixed, so retrieval is
a deterministic call in our own code rather than a tool.

Nothing here is cached. An author who dislikes a draft asks again and gets a
new one; every call appends a CredentialMetadataGenerationLog row instead.
"""

import asyncio
import json
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
    CredentialMetadataGenerationLog,
    LearningResource,
)
from learning_resources.utils import count_tokens, sanitize_llm_text
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


RESPONSE_SCHEMAS = {
    CredentialMetadataField.description.name: BadgeDescription,
    CredentialMetadataField.criteria.name: BadgeCriteria,
}

# Only criteria is generated from retrieved course content. Criteria are claims
# about what a learner actually did, so they need the course's own material --
# syllabus, assessments, lecture prose. A description is 1-2 sentences about
# what the course is, which the resource metadata and marketing page already
# say directly; adding lecture text to that prompt dilutes it.
FIELDS_USING_CONTENT_FILES = frozenset({CredentialMetadataField.criteria.name})

# Sections that say nothing about what a learner demonstrated:
#
# - instructor CVs and publication lists, about a third of a course page
# - prerequisites, which are the opposite of an outcome -- left in, the model
#   reported prerequisite mathematics as a skill the learner gained
#
# Dropped section by section rather than by cutting everything below the
# heading, because a heading is not reliably last: a program page carries the
# program's own instructors ahead of every child course's content, so cutting
# the tail threw all of it away. Measured over 214 scraped pages, 9 have an
# instructor heading that is not last, and 2 of those -- both programs -- lost
# real content to the cut.
MARKETING_PAGE_DROPPED_SECTIONS = (
    "meet your instructors",
    "about professor",
    "prerequisites",
)

# Heading levels that open a new section, and so end a dropped one. A deeper
# heading (`### Prof. Somebody`) belongs to the section it sits in.
SECTION_HEADING_LEVELS = ("# ", "## ")

# Structure markup and duplicate transcript formats: never prose, and they
# crowd out chunks that are.
EXCLUDED_CHUNK_EXTENSIONS = frozenset({".xml", ".sjson", ".json"})


class CredentialContext(NamedTuple):
    """
    The assembled sources for one resource: its metadata, its marketing page,
    and the content-file chunks retrieved for it.

    Retrieval is what bounds the size of all this:
    CREDENTIAL_METADATA_RETRIEVAL_LIMIT caps how many chunks can be included,
    and every chunk is a bounded embedding chunk.
    """

    metadata: str
    marketing_page: str
    chunks: list[tuple[str, str]]

    def assemble(self, *, include_chunks: bool = True) -> tuple[str, list[str]]:
        """
        Render the sources into the single string sent to the model.

        Args:
            include_chunks (bool): whether to append the retrieved content-file
                chunks -- see FIELDS_USING_CONTENT_FILES

        Returns:
            tuple[str, list[str]]: the context text, and the Qdrant point ids
                of the chunks it includes
        """
        chunks = self.chunks if include_chunks else []
        sections = [self.metadata, self.marketing_page, *(text for _, text in chunks)]
        text = "\n\n".join(section for section in sections if section)
        return text, [point_id for point_id, _ in chunks]


def _render_metadata(resource: LearningResource) -> str:
    """
    Render the resource's own fields as JSON.

    The keys are half the value: they tell the model what each string is,
    which a bare list of values cannot. Empty fields are dropped rather than
    sent as blanks, so the model is never asked to describe an absence.

    The resource url is deliberately absent: with it in context the model
    fabricated `#criteria-N` URIs off whatever host the url pointed at.
    """
    best_run = resource.best_run
    values = {
        "title": resource.title,
        "readable_id": resource.readable_id,
        "description": resource.description,
        "run_description": best_run.description if best_run else None,
        "resource_type": resource.resource_type,
        "certification_type": resource.certification_type,
        "platform": resource.platform.name if resource.platform else None,
        "offered_by": resource.offered_by.name if resource.offered_by else None,
        "departments": [department.name for department in resource.departments.all()],
        "topics": [topic.name for topic in resource.topics.all()],
        "level": best_run.level if best_run else [],
    }
    return "## Course information\n" + json.dumps(
        {key: value for key, value in values.items() if value},
        indent=2,
        # Titles and descriptions carry accents; escaping them to \uXXXX only
        # makes the prompt harder for the model to read.
        ensure_ascii=False,
    )


def _section_title(line: str) -> str | None:
    """
    Return a section heading's title, or None if the line is not one.

    Titles are lowercased, because they are whatever the page's h1s and h2s
    happened to say.
    """
    stripped = line.strip()
    if not stripped.startswith(SECTION_HEADING_LEVELS):
        return None
    return stripped.lstrip("#").strip().lower()


def _prepare_marketing_page(content: str) -> str:
    """
    Cut the marketing page down to the part that bears on skills gained.

    Drops every MARKETING_PAGE_DROPPED_SECTIONS section wherever it appears.

    The site footer -- an MIT address, nav links and a copyright line, under no
    heading of its own -- is left in. Truncating at the copyright line looks
    safe and is not: a program page concatenates its child courses' pages, so
    the first child's footer sits in the middle, and cutting there discarded up
    to 18,500 characters of child-course content.
    """
    kept = []
    dropping = False
    for line in content.splitlines():
        title = _section_title(line)
        if title is not None:
            # A section heading always ends whatever section preceded it, so
            # content after a dropped one is kept.
            dropping = title.startswith(MARKETING_PAGE_DROPPED_SECTIONS)

        if not dropping:
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
            # Already in the context in full, as its own section.
            continue
        usable.append((chunk["point_id"], _render_chunk(chunk)))
    return usable


def retrieval_query(configs: list[CredentialMetadataConfiguration]) -> str:
    """
    Return the query to retrieve course content with, or "" for none.

    Retrieval runs once and its chunks are shared, so the query comes from the
    first configured field that is generated out of course content. Editable
    per configuration in the admin, because which content a criteria prompt
    needs is a judgement that will be retuned.
    """
    return next(
        (
            config.retrieval_query
            for config in configs
            if config.field in FIELDS_USING_CONTENT_FILES and config.retrieval_query
        ),
        "",
    )


async def _retrieve_chunks(
    resource: LearningResource, query: str
) -> list[tuple[str, str]]:
    """
    Retrieve the resource's most relevant content-file chunks.

    Retrieval is best-effort: metadata plus the marketing page is a viable
    degraded context, so a Qdrant outage returns a thinner draft rather than an
    error.
    """
    try:
        chunks = await async_content_file_chunks_for_resource(
            resource.readable_id,
            query,
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


async def build_credential_context(
    resource: LearningResource, query: str = ""
) -> CredentialContext:
    """
    Assemble every source for a resource's credential metadata.

    Args:
        resource (LearningResource): the resource to build context for
        query (str): the content retrieval query. Empty skips Qdrant entirely,
            so a description-only run does not pay for a retrieval nothing
            reads -- and there is no vector search to run without a query.

    Returns:
        CredentialContext: the metadata, marketing page and retrieved chunks
    """
    sources = [
        db_sync_to_async(_render_metadata)(resource),
        db_sync_to_async(_marketing_page_content)(resource),
    ]
    if query:
        sources.append(_retrieve_chunks(resource, query))
    metadata, marketing_page, *retrieved = await asyncio.gather(*sources)
    chunks = retrieved[0] if retrieved else []
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

    A CredentialMetadataGenerationLog row is written whether or not the call
    succeeds -- a failure is exactly the case the log exists to explain.

    Returns:
        dict | None: the structured response, or None if generation failed
    """
    context_text, point_ids = context.assemble(
        include_chunks=config.field in FIELDS_USING_CONTENT_FILES
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

    await db_sync_to_async(CredentialMetadataGenerationLog.objects.create)(
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
    concurrently: run in sequence they take about as long as the sum of their
    output lengths, run concurrently about as long as the slowest.

    Args:
        resource (LearningResource): the resource to generate metadata for
        user (User): the user the generation is logged against

    Returns:
        dict: description (str), criteria (the rendered narrative) and
            criteria_skills (list[str]). A field whose generation failed, or
            which has no active configuration, is absent.
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

    context = await build_credential_context(resource, retrieval_query(configs))
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
    return metadata
