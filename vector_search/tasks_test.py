import datetime

import pytest
from django.conf import settings

from learning_resources.etl.constants import ETLSource
from learning_resources.factories import (
    ContentFileFactory,
    CourseFactory,
    LearningResourceFactory,
    ProgramFactory,
)
from learning_resources.models import LearningResource
from learning_resources_search.constants import (
    COURSE_TYPE,
)
from main.utils import now_in_utc
from vector_search.tasks import embed_new_learning_resources, start_embed_resources

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    "index",
    ["course", "program"],
)
def test_start_embed_resources(mocker, mocked_celery, index):
    """
    start_embed_resources should generate embeddings for each resource type
    """
    settings.QDRANT_HOST = "http://test"
    settings.QDRANT_BASE_COLLECTION_NAME = "test"
    mocker.patch("vector_search.tasks.load_course_blocklist", return_value=[])

    if index == COURSE_TYPE:
        ocw_courses = sorted(
            CourseFactory.create_batch(4, etl_source=ETLSource.ocw.value),
            key=lambda course: course.learning_resource_id,
        )

        for course in ocw_courses:
            ContentFileFactory.create_batch(
                3, run=course.learning_resource.runs.first()
            )

        oll_courses = CourseFactory.create_batch(2, etl_source=ETLSource.ocw.value)

        courses = sorted(
            list(oll_courses) + list(ocw_courses),
            key=lambda course: course.learning_resource_id,
        )
        resource_ids = [c.pk for c in courses]
    else:
        programs = sorted(
            ProgramFactory.create_batch(4),
            key=lambda program: program.learning_resource_id,
        )
        resource_ids = [p.pk for p in programs]

    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
    )

    with pytest.raises(mocked_celery.replace_exception_class):
        start_embed_resources.delay([index], skip_content_files=True)

    generate_embeddings_mock.si.assert_called_once_with(resource_ids, index)
    assert mocked_celery.replace.call_count == 1
    assert mocked_celery.replace.call_args[0][1] == mocked_celery.chain.return_value


@pytest.mark.parametrize(
    "index",
    ["course", "program"],
)
def test_start_embed_resources_without_settings(mocker, mocked_celery, index):
    """
    start_embed_resources should not run unless qdrant settings are specified
    """
    settings.QDRANT_HOST = ""
    settings.QDRANT_BASE_COLLECTION_NAME = ""
    mocker.patch("vector_search.tasks.load_course_blocklist", return_value=[])

    if index == COURSE_TYPE:
        ocw_courses = sorted(
            CourseFactory.create_batch(4, etl_source=ETLSource.ocw.value),
            key=lambda course: course.learning_resource_id,
        )
        for course in ocw_courses:
            ContentFileFactory.create_batch(
                3, run=course.learning_resource.runs.first()
            )
        CourseFactory.create_batch(2, etl_source=ETLSource.ocw.value)
    else:
        ProgramFactory.create_batch(4)

    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
    )
    start_embed_resources.delay([index], skip_content_files=True)

    generate_embeddings_mock.si.assert_not_called()


@pytest.mark.parametrize(
    "period",
    ["daily", "weekly"],
)
def test_embed_new_learning_resources(mocker, mocked_celery, period):
    """
    embed_new_learning_resources should generate embeddings for new resources
    based on the period
    """
    settings.QDRANT_HOST = "http://test"
    settings.QDRANT_BASE_COLLECTION_NAME = "test"
    mocker.patch("vector_search.tasks.load_course_blocklist", return_value=[])

    weekly_since = now_in_utc() - datetime.timedelta(days=5)
    daily_since = now_in_utc() - datetime.timedelta(hours=5)

    LearningResourceFactory.create_batch(
        4, created_on=daily_since, resource_type=COURSE_TYPE, published=True
    )
    LearningResourceFactory.create_batch(
        4, created_on=weekly_since, resource_type=COURSE_TYPE, published=True
    )

    weekly_resource_ids = [
        resource.id
        for resource in LearningResource.objects.filter(
            created_on__gt=now_in_utc() - datetime.timedelta(days=7)
        )
    ]

    daily_resource_ids = [
        resource.id
        for resource in LearningResource.objects.filter(
            created_on__gt=now_in_utc() - datetime.timedelta(days=1)
        )
    ]

    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
    )

    with pytest.raises(mocked_celery.replace_exception_class):
        embed_new_learning_resources.delay(period)
    if period == "weekly":
        generate_embeddings_mock.si.assert_called_once_with(
            weekly_resource_ids, "course"
        )
    else:
        generate_embeddings_mock.si.assert_called_once_with(
            daily_resource_ids, "course"
        )
