"""Common config for pytest and friends"""

# pylint: disable=unused-argument, redefined-outer-name
import logging
import warnings
from types import SimpleNamespace

import factory
import pytest
import responses
from pytest_mock import PytestMockWarning
from urllib3.exceptions import InsecureRequestWarning
from zeal import zeal_ignore

from channels.factories import ChannelUnitDetailFactory
from learning_resources.constants import LearningResourceRelationTypes, OfferedBy
from learning_resources.factories import (
    LearningPathFactory,
    LearningResourceFactory,
    LearningResourceOfferorFactory,
)
from learning_resources.models import LearningResourceRun


@pytest.fixture(autouse=True)
def silence_factory_logging():
    """Only show factory errors"""
    logging.getLogger("factory").setLevel(logging.ERROR)


@pytest.fixture(autouse=True)
def warnings_as_errors():
    """
    Convert warnings to errors. This should only affect unit tests, letting pylint and other plugins
    raise DeprecationWarnings without erroring.
    """  # noqa: E501
    try:
        warnings.resetwarnings()
        warnings.simplefilter("error")
        # For celery
        warnings.simplefilter("ignore", category=ImportWarning)
        warnings.filterwarnings("ignore", category=InsecureRequestWarning)
        warnings.filterwarnings("ignore", category=PytestMockWarning)
        warnings.filterwarnings("ignore", category=ResourceWarning)
        # PyJWT 2.11+ warns when HMAC key is < 32 bytes (tests use short keys)
        warnings.filterwarnings("ignore", module="jwt.*", category=UserWarning)
        # Ignore deprecation warnings in third party libraries
        warnings.filterwarnings(
            "ignore",
            module=".*(api_jwt|api_jws|rest_framework_jwt|astroid|bs4|celery|factory|botocore|posthog|pydantic).*",
            category=DeprecationWarning,
        )
        yield
    finally:
        warnings.resetwarnings()


@pytest.fixture
def randomness():
    """Ensure a fixed seed for factoryboy"""
    factory.fuzzy.reseed_random("happy little clouds")


@pytest.fixture
def indexing_decorator(session_indexing_decorator):
    """
    Fixture that resets the indexing function mock and returns the indexing decorator fixture.
    This can be used if there is a need to test whether or not a function is wrapped in the
    indexing decorator.
    """  # noqa: E501
    session_indexing_decorator.mock_persist_func.reset_mock()
    return session_indexing_decorator


@pytest.fixture
def mocked_celery(mocker):
    """Mock object that patches certain celery functions"""
    exception_class = TabError
    replace_mock = mocker.patch(
        "celery.app.task.Task.replace", autospec=True, side_effect=exception_class
    )
    group_mock = mocker.patch("celery.group", autospec=True)
    chain_mock = mocker.patch("celery.chain", autospec=True)

    return SimpleNamespace(
        replace=replace_mock,
        group=group_mock,
        chain=chain_mock,
        replace_exception_class=exception_class,
    )


@pytest.fixture
def mocked_responses():
    """Mock responses fixture"""
    with responses.RequestsMock() as rsps:
        yield rsps


@pytest.fixture
def offeror_featured_lists():
    """Generate featured offeror lists for testing"""
    for offered_by in OfferedBy.names():
        offeror = LearningResourceOfferorFactory.create(code=offered_by)
        featured_path = LearningPathFactory.create(resources=[]).learning_resource
        for i in range(3):
            resource = LearningResourceFactory.create(
                offered_by=offeror,
                is_course=True,
            )
            if offered_by == OfferedBy.ocw.name:
                for run in LearningResourceRun.objects.filter(
                    learning_resource__id=resource.id
                ):
                    run.resource_prices.set([])
                    run.prices = []
                    run.save()
            featured_path.resources.add(
                resource,
                through_defaults={
                    "relation_type": LearningResourceRelationTypes.LEARNING_PATH_ITEMS,
                    "position": i,
                },
            )
        channel = ChannelUnitDetailFactory.create(unit=offeror).channel
        channel.featured_list = featured_path
        channel.save()


@pytest.fixture(autouse=True)
def check_nplusone(request):
    """Raise nplusone errors"""
    if request.node.get_closest_marker("skip_nplusone_check"):
        with zeal_ignore():
            yield
    else:
        yield
