"""
Generate Open Badges credential metadata for a learning resource.

"""

import asyncio
import json
import logging
import time
from typing import Annotated, NamedTuple

import litellm
from django.conf import settings
from django.db.models import Q
from langchain_litellm import ChatLiteLLM
from typing_extensions import TypedDict

from learning_resources.constants import (
    CredentialMetadataField,
    LearningResourceRelationTypes,
    LearningResourceType,
)
from learning_resources.credentials_store import save_credential_metadata
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

litellm.drop_params = True


class BadgeDescription(TypedDict):
    """Structured response for the Open Badges description field"""

    description: Annotated[
        str, ..., "The Open Badges 3.0 description of the credential, 1-2 sentences"
    ]


class BadgeCriteria(TypedDict):
    """Structured response for the Open Badges criteria field"""

    criteria: Annotated[
        list[str],
        ...,
        "Skill-focused criteria bullets, one skill the learner demonstrated per item",
    ]


RESPONSE_SCHEMAS = {
    CredentialMetadataField.description.name: BadgeDescription,
    CredentialMetadataField.criteria.name: BadgeCriteria,
}

# Only criteria is generated from retrieved course content.
FIELDS_USING_CONTENT_FILES = frozenset({CredentialMetadataField.criteria.name})

# Content-file retrieval is for resources that have content files of their
# own. A program's evidence is its courses' criteria, gathered below, so it
# never retrieves -- enforced here rather than left to its configuration's
# retrieval_query being blank, which an admin can fill in.
RESOURCE_TYPES_USING_CONTENT_FILES = frozenset({LearningResourceType.course.name})

# How much of a provider error a response carries. The untruncated text stays
# on the CredentialMetadataGenerationLog row: a litellm error can quote an
# entire upstream response body, which belongs in the record rather than in
# every client's payload.
MAX_ERROR_DETAIL_CHARS = 500


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
    and -- depending on what kind of resource it is -- the content-file chunks
    retrieved for it, or the criteria of the courses it is made of.

    Retrieval is what bounds the size of all this:
    CREDENTIAL_METADATA_CONTENT_CHUNK_LIMIT caps how many chunks can be included,
    and every chunk is a bounded embedding chunk. A program's course criteria
    are bounded by the number of courses in it.
    """

    metadata: str
    marketing_page: str
    chunks: list[tuple[str, str]]
    # A program only. Its courses' generated criteria, rendered for the
    # prompt, and the readable_ids of any course that has none yet.
    child_criteria: str = ""
    courses_missing_criteria: tuple[str, ...] = ()

    def assemble(self, *, include_evidence: bool = True) -> tuple[str, list[str]]:
        """
        Render the sources into the single string sent to the model.

        Args:
            include_evidence (bool): whether to append what the criteria
                prompt is written from -- retrieved content-file chunks for a
                course, its courses' criteria for a program. Both answer
                "what did the learner do", which is the criteria field's
                question and no other's, so the description prompt gets
                neither. See FIELDS_USING_CONTENT_FILES.

        Returns:
            tuple[str, list[str]]: the context text, and the Qdrant point ids
                of the chunks it includes
        """
        chunks = self.chunks if include_evidence else []
        child_criteria = self.child_criteria if include_evidence else ""
        sections = [
            self.metadata,
            self.marketing_page,
            child_criteria,
            *(text for _, text in chunks),
        ]
        text = "\n\n".join(section for section in sections if section)
        return text, [point_id for point_id, _ in chunks]


class FieldOutcome(NamedTuple):
    """
    What one field's generation produced: a response, an error, or neither.

    Neither is its own case rather than an error: the call succeeded and the
    model simply returned nothing usable, which reads differently to a caller
    than a provider that refused.
    """

    response: dict | None
    error: str


class CredentialMetadata(NamedTuple):
    """
    The generated fields, and why any configured field is missing from them.

    Kept apart rather than merged into one dict so that a caller which
    prepopulates a form can splat `fields` straight into it without having to
    know which of its keys are values and which are explanations.
    """

    fields: dict
    errors: dict[str, str]


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
    """
    try:
        chunks = await async_content_file_chunks_for_resource(
            resource,
            query,
            limit=settings.CREDENTIAL_METADATA_CONTENT_CHUNK_LIMIT,
        )
    except Exception:
        logger.exception(
            "Content file retrieval failed for %s; skipping generation",
            resource.readable_id,
        )
        return []
    return _usable_chunks(chunks)


def _child_course_criteria(resource: LearningResource) -> tuple[str, tuple[str, ...]]:
    """
    Render a program's courses' criteria, and name the courses lacking any.

    A program's criteria are claims about what completing its courses
    demonstrates, so the courses' own generated criteria are the evidence for
    them -- the program has no content files of its own to retrieve.

    Only published courses count. An unpublished course is not generated for
    by the sweep, so requiring its criteria would block its program forever.

    Args:
        resource (LearningResource): the program

    Returns:
        tuple[str, tuple[str, ...]]: the rendered section, empty when no
            course has criteria yet, and the readable_ids of the courses that
            have none. Both empty means every course has criteria.
    """
    courses = (
        LearningResource.objects.filter(
            Q(published=True) | Q(test_mode=True),
            parents__parent=resource,
            parents__relation_type=LearningResourceRelationTypes.PROGRAM_COURSES.value,
        )
        # The program's own ordering, so the prompt reads in course order.
        .order_by("parents__position")
        .values_list("readable_id", "title", "credential_metadata__criteria")
    )

    sections, missing = [], []
    for readable_id, title, criteria in courses:
        if not criteria:
            missing.append(readable_id)
            continue
        bullets = "\n".join(f"- {criterion}" for criterion in criteria)
        sections.append(f"### {title}\n\n{bullets}")

    text = "## Course criteria\n\n" + "\n\n".join(sections) if sections else ""
    return text, tuple(missing)


async def build_credential_context(
    resource: LearningResource, query: str = "", *, child_criteria: bool = False
) -> CredentialContext:
    """
    Assemble every source for a resource's credential metadata.

    Args:
        resource (LearningResource): the resource to build context for
        query (str): the content retrieval query. Empty skips Qdrant entirely,
            so a description-only run does not pay for a retrieval nothing
            reads -- and there is no vector search to run without a query.
        child_criteria (bool): whether to gather the criteria of the courses
            this resource is made of. A program's criteria prompt only.

    Returns:
        CredentialContext: the metadata, marketing page, and whichever
            evidence the resource's own type supplies
    """
    # Keyed rather than positional: which sources are gathered varies by
    # resource type, and a bare unpack silently shifts when one is skipped.
    sources = {
        "metadata": db_sync_to_async(_render_metadata)(resource),
        "marketing_page": db_sync_to_async(_marketing_page_content)(resource),
    }
    if query:
        sources["chunks"] = _retrieve_chunks(resource, query)
    if child_criteria:
        sources["child_criteria"] = db_sync_to_async(_child_course_criteria)(resource)
    gathered = dict(zip(sources, await asyncio.gather(*sources.values())))

    criteria_text, missing = gathered.get("child_criteria", ("", ()))
    return CredentialContext(
        metadata=gathered["metadata"],
        marketing_page=_prepare_marketing_page(gathered["marketing_page"]),
        chunks=gathered.get("chunks", []),
        child_criteria=criteria_text,
        courses_missing_criteria=missing,
    )


def _missing_context_sources(
    context: CredentialContext, *, retrieved: bool, child_criteria: bool = False
) -> list[str]:
    """
    Return the sources the configurations ask for that the context lacks.

    Generating without them is worse than not generating: the output reads
    like any other result, but a description written from the resource's own
    metadata alone, or criteria with none of the course's content behind them,
    is not something to issue a credential from. Returning empty-handed
    leaves the resource with no stored metadata, so the daily sweep picks it
    up again once its marketing page is scraped or its content indexed.

    Args:
        context (CredentialContext): the assembled sources
        retrieved (bool): whether content retrieval was attempted. A
            configuration with a blank retrieval_query is asking for
            generation from the marketing page alone, so empty chunks are not
            a missing source -- nothing was asked for.
        child_criteria (bool): whether the resource's courses' criteria were
            asked for. All of them are required, not merely some: a program's
            criteria are claims about completing the whole of it, so leaving
            a course out states less than the credential is for. The sweep
            picks the program up again once the last course generates.

    Returns:
        list of str: the missing sources, named for a log line and an error
            message. Empty means the context is complete.
    """
    missing = []
    if not context.marketing_page:
        missing.append("marketing page")
    if retrieved and not context.chunks:
        missing.append("course content")
    if child_criteria and (
        context.courses_missing_criteria or not context.child_criteria
    ):
        # `not child_criteria` also covers a program with no courses at all,
        # which has nothing to base criteria on either.
        missing.append("courses' criteria")
    return missing


def _get_llm(config: CredentialMetadataConfiguration) -> ChatLiteLLM:
    """
    Get the ChatLiteLLM instance for a field's configuration.

    """
    return ChatLiteLLM(
        model=config.llm_model,
        temperature=config.temperature,
        api_base=settings.LITELLM_API_BASE,
        request_timeout=settings.CREDENTIAL_METADATA_LLM_TIMEOUT,
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


def _error_detail(error: str) -> str:
    """
    Trim a provider error down to something a response can carry.

    Collapsed onto one line, because these are read beside a form field rather
    than in a log viewer. See MAX_ERROR_DETAIL_CHARS.
    """
    error = " ".join(error.split())
    if len(error) <= MAX_ERROR_DETAIL_CHARS:
        return error
    return error[:MAX_ERROR_DETAIL_CHARS].rstrip() + "..."


async def _generate_field(
    resource: LearningResource,
    config: CredentialMetadataConfiguration,
    context: CredentialContext,
    user=None,
) -> FieldOutcome:
    """
    Generate one credential metadata field and log the attempt.

    A CredentialMetadataGenerationLog row is written whether or not the call
    succeeds -- a failure is exactly the case the log exists to explain.

    Returns:
        FieldOutcome: the structured response, and the error if the call failed
    """
    context_text, point_ids = context.assemble(
        include_evidence=config.field in FIELDS_USING_CONTENT_FILES
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
    return FieldOutcome(response=response, error=error)


def _active_configs(
    resource_type: str, fields: list[str] | None
) -> list[CredentialMetadataConfiguration]:
    """
    Return the active configurations for a resource type, narrowed to `fields`.

    Args:
        resource_type (str): the LearningResourceType being generated for.
        fields (list of str | None): the fields to generate, or None for
            every active configuration

    Returns:
        list of CredentialMetadataConfiguration: the configurations to run
    """
    configs = CredentialMetadataConfiguration.objects.filter(
        is_active=True, resource_type=resource_type
    )
    if fields is not None:
        configs = configs.filter(field__in=fields)
    return list(configs)


async def generate_credential_metadata(
    resource: LearningResource, user=None, fields: list[str] | None = None
) -> CredentialMetadata:
    """
    Generate configured credential metadata fields for a resource.

    The prompts used are the ones configured for the resource's own type.
    Another type's configuration is not a fallback, so a resource whose type
    has none generates nothing.

    The fields share one context and are independent, so they are generated
    concurrently: run in sequence they take about as long as the sum of their
    output lengths, run concurrently about as long as the slowest.

    Args:
        resource (LearningResource): the resource to generate metadata for
        user (User): the user the generation is logged against
        fields (list of str): the fields to generate, defaulting to every
            active configuration. A caller filling in what a partial row is
            missing passes that subset, so the fields already stored are
            neither billed for a second time nor overwritten

    Returns:
        CredentialMetadata: the generated fields -- description (str) and
            criteria (list[str]) -- and one error per requested field that is
            missing from them. A field with no active configuration appears in
            neither: nothing was asked of it, so there is nothing to explain.
    """
    configs = await db_sync_to_async(_active_configs)(resource.resource_type, fields)
    if not configs:
        logger.warning(
            "No active %s CredentialMetadataConfiguration%s;"
            " nothing to generate for %s",
            resource.resource_type,
            f" for {', '.join(fields)}" if fields is not None else "",
            resource.readable_id,
        )
        return CredentialMetadata(fields={}, errors={})

    # What the criteria prompt is written from depends on the resource type:
    # a course retrieves its own content files, a program reads the criteria
    # already generated for its courses.
    generating_criteria = any(
        config.field == CredentialMetadataField.criteria.name for config in configs
    )
    uses_content_files = resource.resource_type in RESOURCE_TYPES_USING_CONTENT_FILES
    uses_child_criteria = (
        generating_criteria
        and resource.resource_type == LearningResourceType.program.name
    )
    query = retrieval_query(configs) if uses_content_files else ""

    context = await build_credential_context(
        resource, query, child_criteria=uses_child_criteria
    )
    if context.courses_missing_criteria:
        logger.warning(
            "%s has %d course(s) with no criteria generated yet: %s",
            resource.readable_id,
            len(context.courses_missing_criteria),
            ", ".join(context.courses_missing_criteria),
        )
    missing = _missing_context_sources(
        context, retrieved=bool(query), child_criteria=uses_child_criteria
    )
    if missing:
        sources = " and ".join(missing)
        logger.warning(
            "Not generating credential metadata for %s: missing its %s",
            resource.readable_id,
            sources,
        )
        detail = (
            f"Nothing was generated: the {resource.resource_type}"
            f" is missing its {sources}."
        )
        return CredentialMetadata(
            fields={}, errors={config.field: detail for config in configs}
        )

    outcomes = await asyncio.gather(
        *[_generate_field(resource, config, context, user=user) for config in configs]
    )

    fields, errors = {}, {}
    for config, outcome in zip(configs, outcomes):
        value = (outcome.response or {}).get(config.field)
        if isinstance(value, list):
            value = [item for item in value if item]
        if value:
            fields[config.field] = value
        elif outcome.error:
            errors[config.field] = _error_detail(outcome.error)
        else:
            errors[config.field] = f"The model returned no {config.field}."
    return CredentialMetadata(fields=fields, errors=errors)


async def generate_and_save_credential_metadata(
    resource: LearningResource, user=None, fields: list[str] | None = None
) -> CredentialMetadata:
    """
    Generate a resource's credential metadata and store what was generated.

    Args:
        resource (LearningResource): the resource to generate metadata for
        user (User): the user the generation is logged against
        fields (list of str): the fields to generate, defaulting to every
            active configuration -- see `generate_credential_metadata`

    Returns:
        CredentialMetadata: exactly what `generate_credential_metadata`
            returned. Nothing is stored when it generated nothing, so a failed
            run leaves the previous values in force.
    """
    generated = await generate_credential_metadata(resource, user=user, fields=fields)
    await db_sync_to_async(save_credential_metadata)(resource, generated.fields)
    return generated
