"""Tests for learning_resources.models"""

import re
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from django.db import IntegrityError, transaction

from channels.factories import ChannelFactory
from learning_resources.constants import (
    LearningResourceRelationTypes,
    LearningResourceType,
)
from learning_resources.factories import (
    ContentFileFactory,
    CourseFactory,
    LearningPathFactory,
    LearningResourceFactory,
    LearningResourceRunFactory,
    LearningResourceTopicFactory,
    LearningResourceViewEventFactory,
    ProgramFactory,
)
from learning_resources.models import (
    ContentFile,
    CredentialMetadata,
    LearningResource,
)
from main.utils import now_in_utc

pytestmark = [pytest.mark.django_db]


def test_program_creation():
    """Test that a program has associated LearningResource, run, topics, etc"""
    program = ProgramFactory.create()
    resource = program.learning_resource
    assert resource.title is not None
    assert resource.image.url is not None
    assert resource.resource_type == LearningResourceType.program.name
    assert resource.program == program
    assert program.courses.count() >= 1
    run = program.runs.first()
    assert run.start_date is not None
    assert run.image.url is not None
    assert len(run.resource_prices.all()) > 0
    assert run.instructors.count() > 0
    assert resource.topics.count() > 0
    assert resource.offered_by is not None
    assert resource.runs.count() == program.runs.count()
    assert len(resource.resource_prices.all()) == 0


def test_course_creation():
    """Test that a course has associated LearningResource, runs, topics, etc"""
    course = CourseFactory.create()
    resource = course.learning_resource
    assert resource.resource_type == LearningResourceType.course.name
    assert resource.title is not None
    assert resource.image.url is not None
    assert 0 <= len(resource.resource_prices.all()) <= 3
    assert resource.course == course
    run = resource.runs.first()
    assert run.start_date is not None
    assert run.image.url is not None
    assert len(run.resource_prices.all()) > 0
    assert run.instructors.count() > 0
    assert resource.topics.count() > 0
    assert resource.offered_by is not None
    assert resource.runs.count() == course.runs.count()
    assert len(resource.resource_prices.all()) == 0


def test_best_run_and_published_runs_ignore_variant_runs():
    """Variant runs should not drive displayed run data."""
    resource = LearningResourceFactory.create(
        resource_type=LearningResourceType.course.name
    )
    resource.runs.all().delete()
    now = datetime.now(tz=UTC)
    b2b_run = LearningResourceRunFactory.create(
        learning_resource=resource,
        published=True,
        b2b_only=True,
        is_variant=True,
        start_date=now + timedelta(days=1),
        end_date=now + timedelta(days=90),
        enrollment_start=now - timedelta(days=1),
        enrollment_end=now + timedelta(days=30),
    )
    public_run = LearningResourceRunFactory.create(
        learning_resource=resource,
        published=True,
        is_variant=False,
        start_date=now + timedelta(days=10),
        end_date=now + timedelta(days=100),
        enrollment_start=now - timedelta(days=1),
        enrollment_end=now + timedelta(days=30),
    )

    serialized_resource = LearningResource.objects.for_serialization().get(
        id=resource.id
    )

    assert serialized_resource.best_run == public_run
    assert serialized_resource.published_runs == [public_run]
    assert b2b_run not in serialized_resource.published_runs


def test_learning_resources_views_count():
    """Test that views count is correct"""
    course = CourseFactory.create()
    resource = course.learning_resource
    LearningResourceViewEventFactory.create_batch(3, learning_resource=resource)
    assert resource.views_count == 3
    assert (
        LearningResource.objects.for_serialization().get(id=resource.id).views_count
        == 3
    )
    assert (
        LearningResource.objects.for_search_serialization()
        .get(id=resource.id)
        .views_count
        == 3
    )


def test_learning_resources_in_featured_lists_count():
    """Test that in_featured_lists count is correct"""
    course = CourseFactory.create()
    resource = course.learning_resource
    assert resource.in_featured_lists == 0

    channel = ChannelFactory.create()
    featured_learning_path = LearningPathFactory.create().learning_resource
    featured_learning_path.resources.set(
        [resource],
        through_defaults={
            "relation_type": LearningResourceRelationTypes.LEARNING_PATH_ITEMS
        },
    )

    channel = ChannelFactory.create()
    channel.featured_list = featured_learning_path
    channel.save()

    other_learning_path = LearningPathFactory.create().learning_resource
    other_learning_path.resources.set(
        [resource],
        through_defaults={
            "relation_type": LearningResourceRelationTypes.LEARNING_PATH_ITEMS
        },
    )

    assert featured_learning_path.resources.count() == 1
    assert featured_learning_path.channel.first() == channel
    assert LearningResource.objects.get(id=resource.id).in_featured_lists == 1
    assert (
        LearningResource.objects.for_serialization()
        .get(id=resource.id)
        .in_featured_lists
        == 1
    )
    assert (
        LearningResource.objects.for_search_serialization()
        .get(id=resource.id)
        .in_featured_lists
        == 1
    )


def test_topics_for_serialization_ordered_by_name():
    """Topics should serialize in alphabetical order regardless of creation order"""
    names = ["Physics", "Biology", "Chemistry"]
    resource = LearningResourceFactory.create()
    resource.topics.set([LearningResourceTopicFactory.create(name=n) for n in names])

    prefetched = LearningResource.objects.for_serialization().get(id=resource.id)
    assert [topic.name for topic in prefetched.topics_for_serialization()] == sorted(
        names
    )
    # the plain related manager has to agree with the prefetch: serializers use both
    assert [topic.name for topic in resource.topics.all()] == sorted(names)


def test_content_file_run_key_unique():
    """A second ContentFile with the same (run, key) is rejected"""
    run = LearningResourceRunFactory.create()
    ContentFile.objects.create(run=run, key="file.pdf")

    with pytest.raises(IntegrityError), transaction.atomic():
        ContentFile.objects.create(run=run, key="file.pdf")


def test_content_file_null_key_unique():
    """NULLS NOT DISTINCT: a second keyless ContentFile on the same run is rejected"""
    run = LearningResourceRunFactory.create()
    ContentFile.objects.create(run=run, key=None)

    with pytest.raises(IntegrityError), transaction.atomic():
        ContentFile.objects.create(run=run, key=None)


def test_content_file_visible_and_hidden_are_complements():
    """visible() and hidden() partition every row, with no overlap"""
    now = now_in_utc()
    run = LearningResourceRunFactory.create()
    rows = {
        name: ContentFileFactory.create(run=run, published=published, release_date=date)
        for name, published, date in [
            ("undated", True, None),
            ("past", True, now - timedelta(days=1)),
            ("exactly_now", True, now),
            ("future", True, now + timedelta(days=1)),
            ("past_unpublished", False, now - timedelta(days=1)),
        ]
    }
    names = {row.id: name for name, row in rows.items()}

    def named(queryset):
        return {names[pk] for pk in queryset.values_list("id", flat=True)}

    assert named(ContentFile.objects.visible(now=now)) == {
        "undated",
        "past",
        "exactly_now",
    }
    assert named(ContentFile.objects.hidden(now=now)) == {"future", "past_unpublished"}


def test_content_file_visible_on_related_manager():
    """visible()/hidden() work through the run's related manager, defaulting now"""
    run = LearningResourceRunFactory.create()
    other_run = LearningResourceRunFactory.create()
    visible_file = ContentFileFactory.create(run=run, published=True)
    ContentFileFactory.create(
        run=run, published=True, release_date=now_in_utc() + timedelta(days=1)
    )
    ContentFileFactory.create(run=other_run, published=True)

    assert list(run.content_files.visible()) == [visible_file]
    assert run.content_files.hidden().count() == 1


def test_credential_metadata_round_trip():
    """A stored description and criteria list read back unchanged"""
    resource = LearningResourceFactory.create(is_course=True)
    CredentialMetadata.objects.create(
        learning_resource=resource,
        description="A course about modelling fluid flow.",
        criteria=["Applied conservation laws", "Modelled fluid flow"],
    )

    stored = LearningResource.objects.get(id=resource.id).credential_metadata
    assert stored.description == "A course about modelling fluid flow."
    assert stored.criteria == ["Applied conservation laws", "Modelled fluid flow"]


def test_credential_metadata_long_criteria():
    """A criteria bullet longer than any varchar is stored whole"""
    resource = LearningResourceFactory.create(is_course=True)
    bullet = "Demonstrated " + ("a very specific skill " * 500)

    stored = CredentialMetadata.objects.create(
        learning_resource=resource, criteria=[bullet]
    )
    stored.refresh_from_db()

    assert stored.criteria == [bullet]


def test_credential_metadata_deleted_with_its_resource():
    """Metadata does not outlive the resource it describes"""
    resource = LearningResourceFactory.create(is_course=True)
    CredentialMetadata.objects.create(
        learning_resource=resource, description="A course"
    )

    resource.delete()

    assert not CredentialMetadata.objects.exists()


# Visible means published and released. A query filtering content files on
# published alone shows unreleased rows, and nothing catches that at runtime,
# so this test scans the source for such queries. Each allowed one below isn't
# a visibility check or reads rows OLX never dates. Keys are prefixes of the
# query with whitespace removed.
CONTENT_FILE_PUBLISHED_READERS = {
    # OCW learning materials: OCW files have no release date
    "learning_resources/tasks.py: content_files.filter(published=True).values_list",
    # marketing pages attached directly to a resource: never dated
    "learning_resources/tasks.py: ContentFile.objects.filter(file_type=MARKETING",
    "learning_resources/credentials.py: ContentFile.objects.filter(learning_resource=",
    "learning_resources/utils.py: ContentFile.objects.filter(learning_resource_id__in=all_course_ids",
    # units link a run's files before they release; readers filter visibility
    "learning_resources/etl/loaders.py: ContentFile.objects.filter(run=run, published=True).values_list",
    # "did this archive ever produce rows", not visibility
    "learning_resources/etl/edx_shared.py: content_files.filter(published=True).exists()",
    "learning_resources/etl/canvas.py: content_files.filter(published=True).exists()",
    # writers that flip published, and the soft-delete purge of published=False rows
    "learning_resources/utils.py: resource_content_files.filter(published=True).update(",
    "learning_resources/utils.py: ContentFile.objects.filter(learning_resource_id__in=resource_ids",
    "learning_resources_search/indexing_api.py: content_files.filter(published=True).update(",
    "learning_resources/tasks.py: ContentFile.objects.filter(published=False",
    "learning_resources/etl/loaders.py: ContentFile.objects.filter(run=course_run, published=True",
    "learning_resources/tasks.py: ContentFile.objects.filter(id__in=chunk",
}

CONTENT_FILE_QUERY_RE = re.compile(
    r"(?:ContentFile\.objects|\w*content_files)"
    r"(?:\.\w+\((?:[^()]|\([^()]*\))*\))*?"
    r"\.(?:filter|exclude)\((?:[^()]|\([^()]*\))*\bpublished\b"
    r"(?:[^()]|\([^()]*\))*\)(?:\.\w+\((?:[^()]|\([^()]*\))*\))*"
)


def _query_key(rel: str, snippet: str) -> str:
    """Return rel and the matched query with all whitespace removed"""
    flat = re.sub(r"\s+", "", snippet)
    return f"{rel}:{flat}"


def test_content_file_readers_use_visible_not_published():
    """Every content file query on `published` is an allowed non-visibility site"""
    root = Path(__file__).resolve().parents[1]
    offenders = []
    allowed = {re.sub(r"\s+", "", key) for key in CONTENT_FILE_PUBLISHED_READERS}
    for path in sorted(
        p
        for app in ("learning_resources", "learning_resources_search", "vector_search")
        for p in (root / app).rglob("*.py")
        if not p.name.endswith("_test.py") and "migrations" not in p.parts
    ):
        text = path.read_text()
        rel = str(path.relative_to(root))
        for match in CONTENT_FILE_QUERY_RE.finditer(text):
            key = _query_key(rel, match.group(0))
            if not any(key.startswith(prefix) for prefix in allowed):
                line = text.count("\n", 0, match.start()) + 1
                offenders.append(f"{rel}:{line}: {match.group(0).strip()}")
    assert offenders == [], (
        "Content file readers must use ContentFile.objects.visible()/hidden(); "
        "add deliberate non-visibility sites to CONTENT_FILE_PUBLISHED_READERS:\n"
        + "\n".join(offenders)
    )
