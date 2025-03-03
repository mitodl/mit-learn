import datetime

import pytest
from django.conf import settings

from learning_resources.etl.constants import RESOURCE_FILE_ETL_SOURCES, ETLSource
from learning_resources.factories import (
    ContentFileFactory,
    CourseFactory,
    LearningResourceFactory,
    LearningResourceRunFactory,
    ProgramFactory,
)
from learning_resources.models import ContentFile, LearningResource
from learning_resources_search.constants import (
    COURSE_TYPE,
)
from main.utils import now_in_utc
from vector_search.tasks import (
    embed_learning_resources_by_id,
    embed_new_content_files,
    embed_new_learning_resources,
    start_embed_resources,
)

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    "index",
    ["course", "program"],
)
def test_start_embed_resources(mocker, mocked_celery, index):
    """
    start_embed_resources should generate embeddings for each resource type
    """

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
        start_embed_resources.delay([index], skip_content_files=True, overwrite=True)

    generate_embeddings_mock.si.assert_called_once_with(
        resource_ids,
        index,
        True,  # noqa: FBT003
    )
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
    start_embed_resources.delay([index], skip_content_files=True, overwrite=True)

    generate_embeddings_mock.si.assert_not_called()


def test_embed_new_learning_resources(mocker, mocked_celery):
    """
    embed_new_learning_resources should generate embeddings for new resources
    based on the period
    """
    mocker.patch("vector_search.tasks.load_course_blocklist", return_value=[])

    daily_since = now_in_utc() - datetime.timedelta(hours=5)

    LearningResourceFactory.create_batch(
        4, created_on=daily_since, resource_type=COURSE_TYPE, published=True
    )
    # create resources older than a day
    LearningResourceFactory.create_batch(
        4,
        created_on=now_in_utc() - datetime.timedelta(days=5),
        resource_type=COURSE_TYPE,
        published=True,
    )

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
        embed_new_learning_resources.delay()
    list(mocked_celery.group.call_args[0][0])

    embedded_ids = generate_embeddings_mock.si.mock_calls[0].args[0]
    assert sorted(daily_resource_ids) == sorted(embedded_ids)


def test_embed_new_content_files(mocker, mocked_celery):
    """
    embed_new_content_files should generate embeddings for new content files
    created within the last day
    """
    mocker.patch("vector_search.tasks.load_course_blocklist", return_value=[])

    daily_since = now_in_utc() - datetime.timedelta(hours=5)

    ContentFileFactory.create_batch(4, created_on=daily_since, published=True)
    # create resources older than a day
    ContentFileFactory.create_batch(
        4,
        created_on=now_in_utc() - datetime.timedelta(days=5),
        published=True,
    )

    daily_content_file_ids = [
        resource.id
        for resource in ContentFile.objects.filter(
            created_on__gt=now_in_utc() - datetime.timedelta(days=1)
        )
    ]

    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
    )

    with pytest.raises(mocked_celery.replace_exception_class):
        embed_new_content_files.delay()
    list(mocked_celery.group.call_args[0][0])

    embedded_ids = generate_embeddings_mock.si.mock_calls[0].args[0]
    assert sorted(daily_content_file_ids) == sorted(embedded_ids)


def test_embed_learning_resources_by_id(mocker, mocked_celery):
    """
    embed_learning_resources_by_id should generate embeddings for resources
    based the ids passed as well as associated contentfiles
    """
    mocker.patch("vector_search.tasks.load_course_blocklist", return_value=[])

    resources = LearningResourceFactory.create_batch(
        4,
        resource_type=COURSE_TYPE,
        etl_source=RESOURCE_FILE_ETL_SOURCES[0],
        published=True,
    )

    resource_ids = [resource.id for resource in resources]

    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
    )
    content_ids = []
    for resource in resources:
        cf = ContentFileFactory.create(
            run=LearningResourceRunFactory.create(learning_resource=resource)
        )
        content_ids.append(cf.id)

    with pytest.raises(mocked_celery.replace_exception_class):
        embed_learning_resources_by_id.delay(
            resource_ids, skip_content_files=False, overwrite=True
        )
    for mock_call in generate_embeddings_mock.si.mock_calls[1:]:
        assert mock_call.args[0][0] in content_ids
        assert mock_call.args[1] == "content_file"
    embedded_resource_ids = generate_embeddings_mock.si.mock_calls[0].args[0]
    assert sorted(resource_ids) == sorted(embedded_resource_ids)


def test_embedded_content_from_next_run(mocker, mocked_celery):
    """
    Content files to embed should come from next course run
    """

    mocker.patch("vector_search.tasks.load_course_blocklist", return_value=[])

    course = CourseFactory.create(etl_source=ETLSource.ocw.value)
    course.runs.all().delete()
    other_run = LearningResourceRunFactory.create(
        learning_resource=course.learning_resource,
        created_on=datetime.datetime.now(tz=datetime.UTC) - datetime.timedelta(days=2),
    )
    LearningResourceRunFactory.create(
        learning_resource=course.learning_resource,
        created_on=datetime.datetime.now(tz=datetime.UTC) + datetime.timedelta(days=2),
    )

    next_run_contentfiles = [
        cf.id
        for cf in ContentFileFactory.create_batch(
            3, run=course.learning_resource.next_run
        )
    ]
    # create contentfiles using the other run
    ContentFileFactory.create_batch(3, run=other_run)

    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
    )

    with pytest.raises(mocked_celery.replace_exception_class):
        start_embed_resources.delay(
            ["course"], skip_content_files=False, overwrite=True
        )

    generate_embeddings_mock.si.assert_called_with(
        next_run_contentfiles,
        "content_file",
        True,  # noqa: FBT003
    )


def test_embedded_content_from_latest_run_if_next_missing(mocker, mocked_celery):
    """
    Content files to embed should come from latest run if the next run is missing
    """

    mocker.patch("vector_search.tasks.load_course_blocklist", return_value=[])

    course = CourseFactory.create(etl_source=ETLSource.ocw.value)
    course.runs.all().delete()
    latest_run = LearningResourceRunFactory.create(
        learning_resource=course.learning_resource,
        created_on=datetime.datetime.now(tz=datetime.UTC) - datetime.timedelta(hours=1),
    )
    latest_run_contentfiles = [
        cf.id for cf in ContentFileFactory.create_batch(3, run=latest_run)
    ]
    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
    )

    with pytest.raises(mocked_celery.replace_exception_class):
        start_embed_resources.delay(
            ["course"], skip_content_files=False, overwrite=True
        )

    generate_embeddings_mock.si.assert_called_with(
        latest_run_contentfiles,
        "content_file",
        True,  # noqa: FBT003
    )
