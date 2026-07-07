"""Tests for learning_resources.models"""

from datetime import UTC, datetime, timedelta

import pytest

from channels.factories import ChannelFactory
from learning_resources.constants import (
    LearningResourceRelationTypes,
    LearningResourceType,
)
from learning_resources.factories import (
    CourseFactory,
    LearningPathFactory,
    LearningResourceFactory,
    LearningResourceRunFactory,
    LearningResourceViewEventFactory,
    ProgramFactory,
)
from learning_resources.models import LearningResource

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
        is_b2b=True,
        is_variant=True,
        start_date=now + timedelta(days=1),
        end_date=now + timedelta(days=90),
        enrollment_start=now - timedelta(days=1),
        enrollment_end=now + timedelta(days=30),
    )
    public_run = LearningResourceRunFactory.create(
        learning_resource=resource,
        published=True,
        is_b2b=False,
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
