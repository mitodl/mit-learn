"""Tests for learning_resources.etl.ownership"""

import pytest

from learning_resources.constants import LearningResourceType
from learning_resources.etl.constants import ETLSource
from learning_resources.etl.ownership import (
    OwnershipError,
    assert_pull_allowed,
    assert_push_allowed,
    get_ownership_mode,
    is_push_owned,
    pull_write_allowed,
)
from learning_resources.factories import ETLSourceOwnershipFactory
from learning_resources.models import ETLSourceOwnership

pytestmark = pytest.mark.django_db


def test_defaults_to_pull_when_no_row():
    """No ETLSourceOwnership row means pull ownership."""
    assert get_ownership_mode(ETLSource.see.name, LearningResourceType.course.name) == (
        ETLSourceOwnership.Mode.PULL
    )
    assert is_push_owned(ETLSource.see.name, LearningResourceType.course.name) is False
    assert (
        pull_write_allowed(ETLSource.see.name, LearningResourceType.course.name) is True
    )


def test_push_owned_row_flips_ownership():
    """A push row for one (etl_source, resource_type) only affects that pair."""
    ETLSourceOwnershipFactory.create(
        etl_source=ETLSource.see.name,
        resource_type=LearningResourceType.course.name,
        mode=ETLSourceOwnership.Mode.PUSH,
    )

    assert is_push_owned(ETLSource.see.name, LearningResourceType.course.name) is True
    assert (
        pull_write_allowed(ETLSource.see.name, LearningResourceType.course.name)
        is False
    )

    # A different resource_type for the same source is unaffected.
    assert is_push_owned(ETLSource.see.name, LearningResourceType.program.name) is False
    # A different source is unaffected.
    assert (
        is_push_owned(ETLSource.mitxonline.name, LearningResourceType.course.name)
        is False
    )


def test_assert_pull_allowed_raises_when_push_owned():
    """assert_pull_allowed should raise once a pair is cut over to push."""
    ETLSourceOwnershipFactory.create(
        etl_source=ETLSource.see.name,
        resource_type=LearningResourceType.course.name,
        mode=ETLSourceOwnership.Mode.PUSH,
    )
    with pytest.raises(OwnershipError):
        assert_pull_allowed(ETLSource.see.name, LearningResourceType.course.name)

    # No-op when pull-owned (the default).
    assert_pull_allowed(ETLSource.mitxonline.name, LearningResourceType.course.name)


def test_assert_push_allowed_raises_when_pull_owned():
    """assert_push_allowed should raise for a pair that is still pull-owned."""
    with pytest.raises(OwnershipError):
        assert_push_allowed(ETLSource.mitxonline.name, LearningResourceType.course.name)

    ETLSourceOwnershipFactory.create(
        etl_source=ETLSource.see.name,
        resource_type=LearningResourceType.course.name,
        mode=ETLSourceOwnership.Mode.PUSH,
    )
    # No-op once explicitly cut over to push.
    assert_push_allowed(ETLSource.see.name, LearningResourceType.course.name)
