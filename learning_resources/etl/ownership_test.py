"""Tests for learning_resources.etl.ownership"""

import pytest

from learning_resources.constants import LearningResourceType
from learning_resources.etl.constants import ETLSource
from learning_resources.etl.ownership import (
    OwnershipError,
    Pipeline,
    assert_owner,
    current_pipeline,
    get_owner,
    may_write,
    writing_as,
)
from learning_resources.factories import ETLSourceOwnershipFactory

pytestmark = pytest.mark.django_db

COURSE = LearningResourceType.course.name
PROGRAM = LearningResourceType.program.name
PODCAST = LearningResourceType.podcast.name
EPISODE = LearningResourceType.podcast_episode.name


def test_missing_row_means_legacy():
    """With no row, the legacy ETL owns the pair and may write it."""
    assert get_owner(ETLSource.see.name, COURSE) == Pipeline.LEGACY
    assert current_pipeline() == Pipeline.LEGACY
    assert may_write(ETLSource.see.name, COURSE) is True


@pytest.mark.parametrize("owner", [Pipeline.WAREHOUSE, Pipeline.WEBHOOK])
def test_only_the_owner_may_write(owner):
    """Every pipeline other than the owner is refused."""
    ETLSourceOwnershipFactory.create(
        etl_source=ETLSource.see.name, resource_type=COURSE, owner=owner
    )
    for pipeline in Pipeline:
        with writing_as(pipeline):
            assert may_write(ETLSource.see.name, COURSE) is (pipeline == owner)


def test_ownership_is_scoped_to_the_exact_pair():
    """A row for one (etl_source, resource_type) leaves every other pair legacy."""
    ETLSourceOwnershipFactory.create(
        etl_source=ETLSource.see.name, resource_type=COURSE, owner=Pipeline.WEBHOOK
    )
    assert may_write(ETLSource.see.name, PROGRAM) is True
    assert may_write(ETLSource.mitxonline.name, COURSE) is True


def test_multi_type_write_needs_every_type():
    """A podcast batch writes podcasts and episodes, so it must own both."""
    ETLSourceOwnershipFactory.create(
        etl_source=ETLSource.podcast.name, resource_type=PODCAST, owner=Pipeline.WEBHOOK
    )
    with writing_as(Pipeline.WEBHOOK):
        assert may_write(ETLSource.podcast.name, [PODCAST, EPISODE]) is False
    assert may_write(ETLSource.podcast.name, [PODCAST, EPISODE]) is False

    ETLSourceOwnershipFactory.create(
        etl_source=ETLSource.podcast.name, resource_type=EPISODE, owner=Pipeline.WEBHOOK
    )
    with writing_as(Pipeline.WEBHOOK):
        assert may_write(ETLSource.podcast.name, [PODCAST, EPISODE]) is True


def _fail_while_writing_as(pipeline):
    with writing_as(pipeline):
        assert current_pipeline() == pipeline
        raise RuntimeError


def test_writing_as_restores_the_previous_pipeline():
    """The declaration is scoped to the block, including when it raises."""
    with pytest.raises(RuntimeError):
        _fail_while_writing_as(Pipeline.WAREHOUSE)
    assert current_pipeline() == Pipeline.LEGACY


def test_writing_as_rejects_an_unknown_pipeline():
    """A typo fails loudly instead of matching no owner and skipping every write."""
    with pytest.raises(ValueError, match="warehous"), writing_as("warehous"):
        pass


def test_assert_owner_raises_for_a_non_owner():
    """assert_owner is the failing form, for entry points that must not skip."""
    with writing_as(Pipeline.WEBHOOK), pytest.raises(OwnershipError, match="webhook"):
        assert_owner(ETLSource.mitpe.name, COURSE)

    ETLSourceOwnershipFactory.create(
        etl_source=ETLSource.mitpe.name, resource_type=COURSE, owner=Pipeline.WEBHOOK
    )
    with writing_as(Pipeline.WEBHOOK):
        assert_owner(ETLSource.mitpe.name, COURSE)
