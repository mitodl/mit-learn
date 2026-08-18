import datetime
import random

import grpc
import pytest
from celery.exceptions import Retry
from django.conf import settings
from django.core.cache.backends.locmem import LocMemCache
from django.db.models import Q

from learning_resources.etl.constants import (
    RESOURCE_FILE_ETL_SOURCES,
    ETLSource,
)
from learning_resources.factories import (
    ContentFileFactory,
    ContentSummarizerConfigurationFactory,
    CourseFactory,
    LearningResourceFactory,
    LearningResourcePlatformFactory,
    LearningResourceRunFactory,
    ProgramFactory,
)
from learning_resources.models import ContentFile, LearningResource
from learning_resources_search.constants import (
    CONTENT_FILE_TYPE,
    COURSE_TYPE,
    LEARNING_RESOURCE_TYPES,
    PROGRAM_TYPE,
)
from learning_resources_search.exceptions import RetryError
from learning_resources_search.serializers import (
    serialize_bulk_content_files,
    serialize_bulk_learning_resources,
)
from main.utils import now_in_utc
from vector_search.constants import CONTENT_FILE_PREPASS_PAYLOAD_FIELDS
from vector_search.tasks import (
    _healthcheck_alert_count,
    _record_embedding_failure,
    _retry_countdown,
    _sentry_healthcheck_log,
    embed_learning_resources_by_id,
    embed_new_content_files,
    embed_new_learning_resources,
    embed_run_content_files,
    embeddings_healthcheck,
    embeddings_healthcheck_content_files,
    embeddings_healthcheck_resource_embeddings,
    finalize_embeddings,
    generate_embeddings,
    remove_embeddings,
    remove_run_content_files,
    remove_unpublished_run_content_files,
    start_embed_resources,
    summaries_healthcheck,
)
from vector_search.utils import vector_point_id, vector_point_key

pytestmark = pytest.mark.django_db


def _rpc_error(code):
    """Build a grpc.RpcError carrying a status code, like qdrant's gRPC failures."""
    err = grpc.RpcError()
    err.code = lambda: code
    return err


@pytest.fixture
def embed_cache(mocker):
    """Real (LocMem) backing store for the redis-alias counter in tasks under test."""
    cache = LocMemCache("embed-test", {})
    cache.clear()
    mocker.patch("vector_search.tasks.caches", {"redis": cache})
    return cache


@pytest.mark.parametrize("index", list(LEARNING_RESOURCE_TYPES))
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
        resources = sorted(
            LearningResourceFactory.create_batch(4, resource_type=index),
            key=lambda resource: resource.id,
        )
        resource_ids = [p.pk for p in resources]

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


def test_start_embed_resources_excludes_blocklisted_courses(mocker, mocked_celery):
    """start_embed_resources should not embed courses whose readable_id is blocklisted"""
    courses = CourseFactory.create_batch(3, etl_source=ETLSource.ocw.value)
    blocked = courses[0]
    for course in courses:
        ContentFileFactory.create_batch(2, run=course.learning_resource.runs.first())
    mocker.patch(
        "vector_search.tasks.load_course_blocklist",
        return_value=[blocked.learning_resource.readable_id],
    )
    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
    )

    with pytest.raises(mocked_celery.replace_exception_class):
        start_embed_resources.delay(
            [COURSE_TYPE], skip_content_files=False, overwrite=True
        )

    embedded_resource_ids = {
        resource_id
        for call in generate_embeddings_mock.si.call_args_list
        if call.args[1] == COURSE_TYPE
        for resource_id in call.args[0]
    }
    assert embedded_resource_ids == {
        course.learning_resource_id for course in courses[1:]
    }

    blocked_file_ids = set(
        ContentFile.objects.filter(
            run__learning_resource=blocked.learning_resource
        ).values_list("id", flat=True)
    )
    embedded_file_ids = {
        file_id
        for call in generate_embeddings_mock.si.call_args_list
        if call.args[1] == CONTENT_FILE_TYPE
        for file_id in call.args[0]
    }
    assert embedded_file_ids
    assert not embedded_file_ids & blocked_file_ids


def test_embed_new_learning_resources(mocker, mocked_celery):
    """
    embed_new_learning_resources should generate embeddings for new resources
    based on the period
    """
    settings.QDRANT_EMBEDDINGS_TASK_LOOKBACK_WINDOW = 60 * 2
    mocker.patch("vector_search.tasks.load_course_blocklist", return_value=[])

    new_resources = LearningResourceFactory.create_batch(
        4, resource_type=COURSE_TYPE, published=True
    )
    for resource in new_resources:
        resource.created_on = now_in_utc() - datetime.timedelta(
            minutes=random.randint(1, settings.QDRANT_EMBEDDINGS_TASK_LOOKBACK_WINDOW)  # noqa: S311
        )
        resource.save()
    # create resources older than a day
    old_resources = LearningResourceFactory.create_batch(
        4,
        resource_type=COURSE_TYPE,
        published=True,
    )
    for resource in old_resources:
        resource.created_on = now_in_utc() - datetime.timedelta(
            minutes=random.randint(50, 100)  # noqa: S311
        )
        resource.save()

    new_resource_ids = [
        resource.id
        for resource in LearningResource.objects.filter(
            created_on__gt=now_in_utc()
            - datetime.timedelta(
                minutes=settings.QDRANT_EMBEDDINGS_TASK_LOOKBACK_WINDOW
            )
        )
    ]

    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
    )

    with pytest.raises(mocked_celery.replace_exception_class):
        embed_new_learning_resources.delay()
    list(mocked_celery.group.call_args[0][0])

    assert generate_embeddings_mock.si.call_count == 1
    embedded_ids = generate_embeddings_mock.si.mock_calls[0].args[0]
    assert sorted(new_resource_ids) == sorted(embedded_ids)


def test_embed_new_content_files(mocker, mocked_celery):
    """
    embed_new_content_files should generate embeddings for new content files
    created within the last QDRANT_EMBEDDINGS_TASK_LOOKBACK_WINDOW minutes
    """
    settings.QDRANT_EMBEDDINGS_TASK_LOOKBACK_WINDOW = 60 * 2
    mocker.patch("vector_search.tasks.load_course_blocklist", return_value=[])

    new_contents = ContentFileFactory.create_batch(4, published=True)
    for cf in new_contents:
        cf.created_on = now_in_utc() - datetime.timedelta(
            minutes=random.randint(1, settings.QDRANT_EMBEDDINGS_TASK_LOOKBACK_WINDOW)  # noqa: S311
        )
        cf.save()
    # create resources older than QDRANT_EMBEDDINGS_TASK_LOOKBACK_WINDOW minutes
    old_contents = ContentFileFactory.create_batch(
        4,
        published=True,
    )
    for cf in old_contents:
        cf.created_on = now_in_utc() - datetime.timedelta(
            minutes=random.randint(50, 140)  # noqa: S311
        )
        cf.save()

    new_content_file_ids = [
        resource.id
        for resource in ContentFile.objects.filter(
            created_on__gt=now_in_utc()
            - datetime.timedelta(
                minutes=settings.QDRANT_EMBEDDINGS_TASK_LOOKBACK_WINDOW
            )
        )
    ]

    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
    )
    finalize_embeddings_mock = mocker.patch(
        "vector_search.tasks.finalize_embeddings", autospec=True
    )

    with pytest.raises(mocked_celery.replace_exception_class):
        embed_new_content_files.delay()

    embedded_ids = generate_embeddings_mock.si.mock_calls[0].args[0]
    assert sorted(new_content_file_ids) == sorted(embedded_ids)
    assert all(
        mock_call.kwargs.get("overwrite") is False and "failure_key" in mock_call.kwargs
        for mock_call in generate_embeddings_mock.si.mock_calls
    )
    assert (
        finalize_embeddings_mock.si.call_args.args[0]
        == generate_embeddings_mock.si.mock_calls[0].kwargs["failure_key"]
    )
    chain_args = mocked_celery.chain.call_args.args
    assert chain_args[:-1] == tuple(
        generate_embeddings_mock.si.return_value
        for _ in generate_embeddings_mock.si.mock_calls
    )
    assert chain_args[-1] == finalize_embeddings_mock.si.return_value


def test_remove_run_content_files(mocker, mocked_celery, settings):
    """
    remove_run_content_files should replace itself with removal tasks for all
    content files associated with the run.
    """
    settings.QDRANT_CHUNK_SIZE = 2
    run = LearningResourceRunFactory.create()
    content_file_ids = [
        content_file.id for content_file in ContentFileFactory.create_batch(3, run=run)
    ]
    ContentFileFactory.create()
    remove_embeddings_mock = mocker.patch(
        "vector_search.tasks.remove_embeddings", autospec=True
    )

    with pytest.raises(mocked_celery.replace_exception_class):
        remove_run_content_files.delay(run.id)

    removed_ids = [
        content_file_id
        for mock_call in remove_embeddings_mock.si.mock_calls
        for content_file_id in mock_call.args[0]
    ]
    assert sorted(removed_ids) == sorted(content_file_ids)
    assert all(
        mock_call.args[1] == CONTENT_FILE_TYPE
        for mock_call in remove_embeddings_mock.si.mock_calls
    )
    assert mocked_celery.chain.call_count == 1
    assert mocked_celery.replace.call_count == 1
    assert mocked_celery.replace.call_args[0][1] == mocked_celery.chain.return_value


def test_remove_run_content_files_no_content_files(mocker, mocked_celery):
    """
    remove_run_content_files should short-circuit when there is nothing to remove.
    """
    run = LearningResourceRunFactory.create()
    remove_embeddings_mock = mocker.patch(
        "vector_search.tasks.remove_embeddings", autospec=True
    )

    remove_run_content_files.delay(run.id)

    remove_embeddings_mock.si.assert_not_called()
    mocked_celery.chain.assert_not_called()
    mocked_celery.replace.assert_not_called()


def test_remove_unpublished_run_content_files(mocker, mocked_celery):
    """
    remove_unpublished_run_content_files should only remove unpublished content
    files associated with the run.
    """
    run = LearningResourceRunFactory.create()
    unpublished_content_file = ContentFileFactory.create(run=run, published=False)
    ContentFileFactory.create(run=run, published=True)
    ContentFileFactory.create(published=False)
    remove_embeddings_mock = mocker.patch(
        "vector_search.tasks.remove_embeddings", autospec=True
    )

    with pytest.raises(mocked_celery.replace_exception_class):
        remove_unpublished_run_content_files.delay(run.id)

    remove_embeddings_mock.si.assert_called_once_with(
        [unpublished_content_file.id],
        CONTENT_FILE_TYPE,
    )
    assert mocked_celery.chain.call_count == 1
    assert mocked_celery.replace.call_count == 1
    assert mocked_celery.replace.call_args[0][1] == mocked_celery.chain.return_value


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


def _embedded_content_file_ids(generate_embeddings_mock):
    """Collect all content file ids passed to generate_embeddings across chunks"""
    return {
        cid
        for call in generate_embeddings_mock.si.call_args_list
        if call.args[1] == "content_file"
        for cid in call.args[0]
    }


def test_embedded_content_from_all_runs(mocker, mocked_celery):
    """
    Content files from every run of a course should be embedded, not just best_run
    """

    mocker.patch("vector_search.tasks.load_course_blocklist", return_value=[])

    course = CourseFactory.create(etl_source=ETLSource.ocw.value)
    course.runs.all().delete()
    older_run = LearningResourceRunFactory.create(
        learning_resource=course.learning_resource,
        start_date=datetime.datetime.now(tz=datetime.UTC) - datetime.timedelta(days=2),
    )
    newer_run = LearningResourceRunFactory.create(
        learning_resource=course.learning_resource,
        start_date=datetime.datetime.now(tz=datetime.UTC) + datetime.timedelta(days=2),
    )
    all_contentfiles = {
        cf.id
        for run in (older_run, newer_run)
        for cf in ContentFileFactory.create_batch(3, run=run)
    }

    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
    )

    with pytest.raises(mocked_celery.replace_exception_class):
        start_embed_resources.delay(
            ["course"], skip_content_files=False, overwrite=True
        )

    assert all_contentfiles <= _embedded_content_file_ids(generate_embeddings_mock)


def test_embed_by_id_all_runs_excludes_unpublished(mocker, mocked_celery):
    """
    embed_learning_resources_by_id embeds published content files from all runs and
    excludes unpublished ones
    """

    mocker.patch("vector_search.tasks.load_course_blocklist", return_value=[])

    course = CourseFactory.create(etl_source=ETLSource.ocw.value)
    course.runs.all().delete()
    run_a = LearningResourceRunFactory.create(
        learning_resource=course.learning_resource
    )
    run_b = LearningResourceRunFactory.create(
        learning_resource=course.learning_resource
    )
    published_ids = {
        cf.id
        for run in (run_a, run_b)
        for cf in ContentFileFactory.create_batch(2, run=run, published=True)
    }
    unpublished_ids = {
        cf.id for cf in ContentFileFactory.create_batch(2, run=run_a, published=False)
    }

    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
    )

    with pytest.raises(mocked_celery.replace_exception_class):
        embed_learning_resources_by_id.delay(
            [course.learning_resource.id], skip_content_files=False, overwrite=True
        )

    embedded = _embedded_content_file_ids(generate_embeddings_mock)
    assert published_ids <= embedded
    assert not (unpublished_ids & embedded)


def test_embedded_content_file_without_runs(mocker, mocked_celery):
    """
    Ensure that contentfiles without runs are also embedded for a resource
    """

    mocker.patch("vector_search.tasks.load_course_blocklist", return_value=[])

    course = CourseFactory.create(etl_source=ETLSource.ocw.value)
    course.runs.all().delete()
    latest_run = LearningResourceRunFactory.create(
        learning_resource=course.learning_resource,
        start_date=datetime.datetime.now(tz=datetime.UTC) - datetime.timedelta(hours=1),
    )
    ContentFileFactory.create_batch(3, run=latest_run)
    # create contentfiles without runs
    contentfiles_with_no_run = [
        cf.id
        for cf in ContentFileFactory.create_batch(
            3, learning_resource=course.learning_resource
        )
    ]
    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
    )

    with pytest.raises(mocked_celery.replace_exception_class):
        start_embed_resources.delay(
            ["course"], skip_content_files=False, overwrite=True
        )
    embedded_ids = generate_embeddings_mock.mock_calls[-1].args[0]

    for contentfile_id in contentfiles_with_no_run:
        assert contentfile_id in embedded_ids


def test_start_embed_resources_program_content_files(mocker, mocked_celery):
    """
    start_embed_resources should embed content files for programs
    """
    mocker.patch("vector_search.tasks.load_course_blocklist", return_value=[])

    programs = ProgramFactory.create_batch(2)
    content_ids = []
    for program in programs:
        cf = ContentFileFactory.create(
            learning_resource=program.learning_resource,
            published=True,
        )
        content_ids.append(cf.id)

    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
    )

    with pytest.raises(mocked_celery.replace_exception_class):
        start_embed_resources.delay(
            [PROGRAM_TYPE], skip_content_files=False, overwrite=True
        )

    content_file_calls = [
        call
        for call in generate_embeddings_mock.si.mock_calls
        if call.args[1] == "content_file"
    ]
    embedded_content_ids = []
    for call in content_file_calls:
        embedded_content_ids.extend(call.args[0])
    assert sorted(content_ids) == sorted(embedded_content_ids)


def test_embed_learning_resources_by_id_program_content_files(mocker, mocked_celery):
    """
    embed_learning_resources_by_id should embed content files for programs
    """
    mocker.patch("vector_search.tasks.load_course_blocklist", return_value=[])

    programs = ProgramFactory.create_batch(2)
    resource_ids = [p.learning_resource.id for p in programs]
    content_ids = []
    for program in programs:
        cf = ContentFileFactory.create(
            learning_resource=program.learning_resource,
            published=True,
        )
        content_ids.append(cf.id)

    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
    )

    with pytest.raises(mocked_celery.replace_exception_class):
        embed_learning_resources_by_id.delay(
            resource_ids, skip_content_files=False, overwrite=True
        )

    content_file_calls = [
        call
        for call in generate_embeddings_mock.si.mock_calls
        if call.args[1] == "content_file"
    ]
    embedded_content_ids = []
    for call in content_file_calls:
        embedded_content_ids.extend(call.args[0])
    assert sorted(content_ids) == sorted(embedded_content_ids)


def test_program_embedding_includes_test_mode_unpublished_programs(
    mocker, mocked_celery
):
    """Program embedding should include test-mode unpublished resources in both flows."""
    mocker.patch("vector_search.tasks.load_course_blocklist", return_value=[])

    program = ProgramFactory.create(
        learning_resource__published=False,
        learning_resource__test_mode=True,
    )
    resource_id = program.learning_resource.id
    content_file = ContentFileFactory.create(
        learning_resource=program.learning_resource,
        published=True,
    )

    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
    )

    with pytest.raises(mocked_celery.replace_exception_class):
        start_embed_resources.delay(
            [PROGRAM_TYPE], skip_content_files=False, overwrite=True
        )

    program_calls = [
        call
        for call in generate_embeddings_mock.si.mock_calls
        if call.args[1] == PROGRAM_TYPE
    ]
    content_calls = [
        call
        for call in generate_embeddings_mock.si.mock_calls
        if call.args[1] == CONTENT_FILE_TYPE
    ]
    assert any(resource_id in call.args[0] for call in program_calls)
    assert any(content_file.id in call.args[0] for call in content_calls)

    generate_embeddings_mock.reset_mock()

    with pytest.raises(mocked_celery.replace_exception_class):
        embed_learning_resources_by_id.delay(
            [resource_id], skip_content_files=False, overwrite=True
        )

    program_calls = [
        call
        for call in generate_embeddings_mock.si.mock_calls
        if call.args[1] == PROGRAM_TYPE
    ]
    content_calls = [
        call
        for call in generate_embeddings_mock.si.mock_calls
        if call.args[1] == CONTENT_FILE_TYPE
    ]
    assert any(resource_id in call.args[0] for call in program_calls)
    assert any(content_file.id in call.args[0] for call in content_calls)


def test_embed_new_content_files_without_runs(mocker, mocked_celery):
    """
    embed_new_content_files should generate embeddings for new content files
    created within the last QDRANT_EMBEDDINGS_TASK_LOOKBACK_WINDOW minutes
    """
    mocker.patch("vector_search.tasks.load_course_blocklist", return_value=[])
    course = CourseFactory.create(etl_source=ETLSource.ocw.value)
    daily_since = now_in_utc() - datetime.timedelta(minutes=5)
    ContentFileFactory.create_batch(4, created_on=daily_since, published=True)
    content_files_without_run = [
        cf.id
        for cf in ContentFileFactory.create_batch(
            4,
            learning_resource=course.learning_resource,
            created_on=daily_since,
            published=True,
        )
    ]

    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
    )

    with pytest.raises(mocked_celery.replace_exception_class):
        embed_new_content_files.delay()
    embedded_ids = generate_embeddings_mock.si.mock_calls[0].args[0]
    for contentfile_id in content_files_without_run:
        assert contentfile_id in embedded_ids


def test_embed_run_content_files(mocker, mocked_celery, settings):
    """
    embed_run_content_files should replace itself with embedding tasks for all
    content files associated with the run.
    """
    settings.QDRANT_CHUNK_SIZE = 2
    run = LearningResourceRunFactory.create()
    content_file_ids = [
        content_file.id
        for content_file in ContentFileFactory.create_batch(3, run=run, content="text")
    ]
    ContentFileFactory.create()
    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
    )
    finalize_embeddings_mock = mocker.patch(
        "vector_search.tasks.finalize_embeddings", autospec=True
    )

    with pytest.raises(mocked_celery.replace_exception_class):
        embed_run_content_files.delay(run.id)

    embedded_ids = [
        content_file_id
        for mock_call in generate_embeddings_mock.si.mock_calls
        for content_file_id in mock_call.args[0]
    ]
    assert sorted(embedded_ids) == sorted(content_file_ids)
    assert all(
        mock_call.args[1:] == (CONTENT_FILE_TYPE,)
        and mock_call.kwargs["overwrite"] is True
        and "failure_key" in mock_call.kwargs
        for mock_call in generate_embeddings_mock.si.mock_calls
    )
    # chain = all chunk sigs, then the finalize tail
    chain_args = mocked_celery.chain.call_args.args
    assert chain_args[:-1] == tuple(
        generate_embeddings_mock.si.return_value
        for _ in generate_embeddings_mock.si.mock_calls
    )
    assert chain_args[-1] == finalize_embeddings_mock.si.return_value
    assert (
        finalize_embeddings_mock.si.call_args.args[0]
        == generate_embeddings_mock.si.mock_calls[0].kwargs["failure_key"]
    )
    assert mocked_celery.replace.call_count == 1


def test_embed_run_content_files_no_content_files(mocker, mocked_celery):
    """
    embed_run_content_files should short-circuit when there is nothing to embed.
    """
    run = LearningResourceRunFactory.create()
    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
    )

    embed_run_content_files.delay(run.id)

    generate_embeddings_mock.si.assert_not_called()
    mocked_celery.chain.assert_not_called()
    mocked_celery.replace.assert_not_called()


def test_embed_run_content_files_no_files_returns_none(mocker, mocked_celery):
    """No content files → no chain, no replace, returns None."""
    run = LearningResourceRunFactory.create()  # no content files
    mocker.patch("vector_search.tasks.generate_embeddings", autospec=True)
    mocker.patch("vector_search.tasks.finalize_embeddings", autospec=True)
    assert embed_run_content_files(run.id) is None
    mocked_celery.chain.assert_not_called()


def test_embed_run_content_files_skips_unpublished(mocker, mocked_celery, settings):
    """Unpublished files are never embedded."""
    settings.QDRANT_CHUNK_SIZE = 50
    run = LearningResourceRunFactory.create()
    published = ContentFileFactory.create(run=run, published=True, content="aaa")
    ContentFileFactory.create(run=run, published=False, content="bbb")
    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
    )

    with pytest.raises(mocked_celery.replace_exception_class):
        embed_run_content_files.delay(run.id)

    assert _embedded_content_file_ids(generate_embeddings_mock) == {published.id}


def test_embed_run_content_files_skips_contentless(mocker, mocked_celery, settings):
    """
    Files without content never produce Qdrant points, so the pre-pass must not
    flag them as stale (they would otherwise be re-dispatched on every load).
    """
    settings.QDRANT_CHUNK_SIZE = 50
    run = LearningResourceRunFactory.create()
    with_content = ContentFileFactory.create(run=run, published=True, content="aaa")
    ContentFileFactory.create(run=run, published=True, content="")
    ContentFileFactory.create(run=run, published=True, content=None)
    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
    )

    with pytest.raises(mocked_celery.replace_exception_class):
        embed_run_content_files.delay(run.id)

    assert _embedded_content_file_ids(generate_embeddings_mock) == {with_content.id}


def test_embed_run_content_files_removes_leftover_contentless_points(mocker):
    """
    A published file whose content became empty keeps the point embedded from
    its old content; the pre-pass detects and removes it. Contentless files
    with no stored point trigger no removal.
    """
    run = LearningResourceRunFactory.create()
    emptied = ContentFileFactory.create(run=run, published=True, content="")
    ContentFileFactory.create(run=run, published=True, content=None)
    pids = _serializer_chunk0_pids([emptied])
    mocker.patch(
        "vector_search.tasks._stored_content_payloads",
        return_value={pids[emptied.id]: {"checksum": "from-old-content"}},
    )
    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
    )
    remove_mock = mocker.patch(
        "vector_search.tasks.remove_qdrant_records", autospec=True
    )

    assert embed_run_content_files(run.id) is None

    generate_embeddings_mock.si.assert_not_called()
    remove_mock.assert_called_once_with([emptied.id], CONTENT_FILE_TYPE)


def test_embed_run_content_files_retries_transient_qdrant_errors(mocker):
    """A transient Qdrant error in the pre-pass retries instead of failing the run."""
    run = LearningResourceRunFactory.create()
    ContentFileFactory.create(run=run, published=True, content="aaa")
    mocker.patch(
        "vector_search.tasks._stored_content_payloads",
        side_effect=_rpc_error(grpc.StatusCode.UNAVAILABLE),
    )
    retry = mocker.patch.object(embed_run_content_files, "retry", side_effect=Retry())

    with pytest.raises(Retry):
        embed_run_content_files(run.id)

    retry.assert_called_once()
    assert retry.call_args.kwargs["countdown"] >= 0


def test_embed_run_content_files_does_not_retry_terminal_errors(mocker):
    """A non-transient Qdrant error in the pre-pass propagates without retry."""
    run = LearningResourceRunFactory.create()
    ContentFileFactory.create(run=run, published=True, content="aaa")
    mocker.patch(
        "vector_search.tasks._stored_content_payloads",
        side_effect=_rpc_error(grpc.StatusCode.INVALID_ARGUMENT),
    )

    with pytest.raises(grpc.RpcError):
        embed_run_content_files(run.id)


def _serializer_chunk0_pids(content_files):
    """Chunk-0 point ids as the embed pipeline (serializer path) computes them"""
    return {
        doc["id"]: vector_point_id(
            vector_point_key(doc, chunk_number=0, document_type="content_file")
        )
        for doc in serialize_bulk_content_files([cf.id for cf in content_files])
    }


def _stored_payload_entry(content_file, **overrides):
    """Build a stored-payload map entry matching the file's current DB state"""
    return {
        "checksum": content_file.checksum,
        **{
            field: getattr(content_file, field)
            for field in CONTENT_FILE_PREPASS_PAYLOAD_FIELDS
        },
        **overrides,
    }


def test_embed_run_content_files_pre_pass_skips_unchanged(
    mocker, mocked_celery, settings
):
    """
    Only files whose stored Qdrant payload is missing or stale are embedded.

    The stored-payload map is keyed by serializer-derived point ids, so the
    unchanged file is skipped only if the task's pre-pass computes the same
    point id as the embed pipeline.
    """
    settings.QDRANT_CHUNK_SIZE = 50
    run = LearningResourceRunFactory.create()
    # ContentFile.save() computes checksum from content
    unchanged = ContentFileFactory.create(run=run, published=True, content="aaa")
    stale = ContentFileFactory.create(run=run, published=True, content="bbb")
    missing = ContentFileFactory.create(run=run, published=True, content="ccc")
    pids = _serializer_chunk0_pids([unchanged, stale, missing])
    stored_mock = mocker.patch(
        "vector_search.tasks._stored_content_payloads",
        return_value={
            pids[unchanged.id]: _stored_payload_entry(unchanged),
            pids[stale.id]: _stored_payload_entry(stale, checksum="stale-checksum"),
        },
    )
    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
    )

    with pytest.raises(mocked_celery.replace_exception_class):
        embed_run_content_files.delay(run.id)

    assert _embedded_content_file_ids(generate_embeddings_mock) == {
        stale.id,
        missing.id,
    }
    assert set(stored_mock.call_args.args[0]) == set(pids.values())


def test_embed_run_content_files_pre_pass_dispatches_metadata_only_change(
    mocker, mocked_celery, settings
):
    """
    A file with a matching checksum but drifted payload metadata (edited title,
    newly generated summary) is dispatched so its Qdrant payload gets refreshed.
    """
    settings.QDRANT_CHUNK_SIZE = 50
    run = LearningResourceRunFactory.create()
    retitled = ContentFileFactory.create(run=run, published=True, content="aaa")
    summarized = ContentFileFactory.create(run=run, published=True, content="bbb")
    current = ContentFileFactory.create(run=run, published=True, content="ccc")
    pids = _serializer_chunk0_pids([retitled, summarized, current])
    mocker.patch(
        "vector_search.tasks._stored_content_payloads",
        return_value={
            pids[retitled.id]: _stored_payload_entry(retitled, title="old title"),
            pids[summarized.id]: _stored_payload_entry(summarized, summary=""),
            pids[current.id]: _stored_payload_entry(current),
        },
    )
    summarized.summary = "a new summary"
    summarized.save()
    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
    )

    with pytest.raises(mocked_celery.replace_exception_class):
        embed_run_content_files.delay(run.id)

    assert _embedded_content_file_ids(generate_embeddings_mock) == {
        retitled.id,
        summarized.id,
    }


def test_content_file_prepass_fields_are_serializer_pass_through():
    """
    Every pre-pass-compared field must be an exact serializer pass-through of
    the ContentFile column: a transformed field would never converge with the
    stored payload, flagging every file on every load.
    """
    content_file = ContentFileFactory.create(
        run=LearningResourceRunFactory.create(),
        published=True,
        content="some content",
        summary="a summary",
        flashcards=[{"question": "q", "answer": "a"}],
    )
    doc = next(iter(serialize_bulk_content_files([content_file.id])))
    for field in ("checksum", *CONTENT_FILE_PREPASS_PAYLOAD_FIELDS):
        assert doc[field] == getattr(content_file, field), field


def test_embed_run_content_files_all_unchanged_dispatches_nothing(
    mocker, mocked_celery
):
    """A fully-unchanged run embeds nothing and schedules no chain."""
    run = LearningResourceRunFactory.create()
    files = ContentFileFactory.create_batch(2, run=run, published=True, content="x")
    pids = _serializer_chunk0_pids(files)
    mocker.patch(
        "vector_search.tasks._stored_content_payloads",
        return_value={pids[cf.id]: _stored_payload_entry(cf) for cf in files},
    )
    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
    )

    assert embed_run_content_files(run.id) is None

    generate_embeddings_mock.si.assert_not_called()
    mocked_celery.chain.assert_not_called()


def _missing_everything(batch, collection_name=None):
    """Report every point in the batch as absent from Qdrant."""
    return list(batch)


def _missing_only(collection):
    """Report every point absent for one collection, nothing missing elsewhere."""

    def fake_filter(batch, collection_name=None):
        return list(batch) if collection_name == collection else []

    return fake_filter


def test_embeddings_healthcheck_dispatches_batches_of_each_kind(mocker, mocked_celery):
    """
    embeddings_healthcheck should dispatch batches of resources and batches of content
    files, each drawn from its own rows, plus the standalone summaries task
    """
    resources = LearningResourceFactory.create_batch(5, published=True)
    content_files = [
        ContentFileFactory.create(
            run=None, learning_resource=resource, content="test", published=True
        )
        for resource in resources
    ]
    LearningResourceFactory.create_batch(2, published=False, test_mode=False)
    expected_ids = sorted(
        LearningResource.objects.filter(
            Q(published=True) | Q(test_mode=True)
        ).values_list("id", flat=True)
    )
    mocker.patch("vector_search.tasks.HEALTHCHECK_RESOURCE_BATCH_SIZE", 2)
    mocker.patch("vector_search.tasks.HEALTHCHECK_CONTENT_FILE_BATCH_SIZE", 2)
    mock_resource_check = mocker.patch(
        "vector_search.tasks.embeddings_healthcheck_resource_embeddings", autospec=True
    )
    mock_content_check = mocker.patch(
        "vector_search.tasks.embeddings_healthcheck_content_files", autospec=True
    )
    mock_summaries = mocker.patch(
        "vector_search.tasks.summaries_healthcheck", autospec=True
    )

    with pytest.raises(mocked_celery.replace_exception_class):
        embeddings_healthcheck.delay()

    # the resource check is batched, and every eligible resource lands in a batch
    resource_batches = [call.args[0] for call in mock_resource_check.si.mock_calls]
    assert all(len(batch) <= 2 for batch in resource_batches)
    assert sorted(rid for batch in resource_batches for rid in batch) == expected_ids
    # the content-file check is batched over content files, not over their resources
    content_batches = [call.args[0] for call in mock_content_check.si.mock_calls]
    assert all(len(batch) <= 2 for batch in content_batches)
    assert sorted(cid for batch in content_batches for cid in batch) == sorted(
        cf.id for cf in content_files
    )
    assert mocked_celery.group.call_count == 1
    assert mocked_celery.replace.call_args[0][1] == mocked_celery.group.return_value
    assert mocked_celery.group.call_args[0][0][0] is mock_summaries.si.return_value
    # every dispatched task shares one run_key, so they share one Sentry alert budget
    run_keys = (
        {call.kwargs["run_key"] for call in mock_resource_check.si.mock_calls}
        | {call.kwargs["run_key"] for call in mock_content_check.si.mock_calls}
        | {call.kwargs["run_key"] for call in mock_summaries.si.mock_calls}
    )
    assert len(run_keys) == 1
    assert next(iter(run_keys)) is not None


def test_embeddings_healthcheck_dispatch_only_queues_checkable_content_files(
    mocker, mocked_celery
):
    """
    Only content files the check could report on are queued -- published, with
    content, belonging to an eligible resource. Anything else is a batch slot spent on
    a file the check would skip, and a resource with no content files at all never
    costs a task.
    """
    published_resource = LearningResourceFactory.create(
        published=True, create_runs=False
    )
    run = LearningResourceRunFactory.create(
        published=True, learning_resource=published_resource
    )
    by_run = ContentFileFactory.create(run=run, content="test", published=True)
    by_resource = ContentFileFactory.create(
        run=None, learning_resource=published_resource, content="test", published=True
    )

    # none of these should reach a content-file task
    ContentFileFactory.create(
        run=None, learning_resource=published_resource, content="test", published=False
    )
    ContentFileFactory.create(
        run=None, learning_resource=published_resource, content="", published=True
    )
    ContentFileFactory.create(
        run=None, learning_resource=published_resource, content=None, published=True
    )
    unpublished_resource = LearningResourceFactory.create(
        published=False, test_mode=False, create_runs=False
    )
    ContentFileFactory.create(
        run=None, learning_resource=unpublished_resource, content="test", published=True
    )
    # a resource with no content files at all costs no content-file task
    LearningResourceFactory.create(published=True, create_runs=False)

    mock_content_check = mocker.patch(
        "vector_search.tasks.embeddings_healthcheck_content_files", autospec=True
    )
    mocker.patch(
        "vector_search.tasks.embeddings_healthcheck_resource_embeddings", autospec=True
    )
    mocker.patch("vector_search.tasks.summaries_healthcheck", autospec=True)

    with pytest.raises(mocked_celery.replace_exception_class):
        embeddings_healthcheck.delay()

    queued_ids = sorted(
        cid for call in mock_content_check.si.mock_calls for cid in call.args[0]
    )
    assert queued_ids == sorted([by_run.id, by_resource.id])


def test_embeddings_healthcheck_caps_a_direct_invocation(mocker, mocked_celery):
    """
    A direct call -- embeddings_healthcheck() in a shell rather than delay() -- has no
    task id. Without a generated fallback every dispatched task would get
    run_key=None, and one manual run would send an uncapped alert per affected
    resource.
    """
    LearningResourceFactory.create_batch(3, published=True)
    mock_resource_check = mocker.patch(
        "vector_search.tasks.embeddings_healthcheck_resource_embeddings", autospec=True
    )
    mocker.patch(
        "vector_search.tasks.embeddings_healthcheck_content_files", autospec=True
    )
    mocker.patch("vector_search.tasks.summaries_healthcheck", autospec=True)

    with pytest.raises(mocked_celery.replace_exception_class):
        embeddings_healthcheck()

    run_keys = {call.kwargs["run_key"] for call in mock_resource_check.si.mock_calls}
    assert len(run_keys) == 1
    assert next(iter(run_keys)) is not None


def test_embeddings_healthcheck_content_files_no_missing_embeddings(mocker):
    """
    A content-file check should stay silent when Qdrant has every point it checks
    """
    lr = LearningResourceFactory.create(published=True)
    LearningResourceRunFactory.create(published=True, learning_resource=lr)
    cf = ContentFileFactory.create(run=lr.runs.first(), content="test", published=True)
    mock_sentry = mocker.patch("vector_search.tasks.sentry_sdk", autospec=True)
    mocker.patch(
        "vector_search.tasks.filter_existing_qdrant_points_by_ids", return_value=[]
    )

    embeddings_healthcheck_content_files([cf.id])
    assert mock_sentry.capture_message.call_count == 0


def test_embeddings_healthcheck_resource_embeddings_no_missing(mocker):
    """
    A batched resource check should stay silent when Qdrant has every point
    """
    resources = LearningResourceFactory.create_batch(3, published=True)
    mock_log = mocker.patch("vector_search.tasks._sentry_healthcheck_log")
    mocker.patch(
        "vector_search.tasks.filter_existing_qdrant_points_by_ids", return_value=[]
    )

    embeddings_healthcheck_resource_embeddings([lr.id for lr in resources])
    assert mock_log.call_count == 0


def test_embeddings_healthcheck_resource_embeddings_batches_qdrant_lookups(mocker):
    """
    A batch must cost one Qdrant lookup per HEALTHCHECK_POINT_BATCH_SIZE points rather
    than one per resource: checking resources one at a time is what turned a full run
    into thousands of round trips.
    """
    resources = LearningResourceFactory.create_batch(5, published=True)
    mocker.patch("vector_search.tasks.HEALTHCHECK_POINT_BATCH_SIZE", 2)
    mock_filter = mocker.patch(
        "vector_search.tasks.filter_existing_qdrant_points_by_ids", return_value=[]
    )

    embeddings_healthcheck_resource_embeddings([lr.id for lr in resources])

    # 5 points at 2 per lookup is 3 lookups, not 5
    assert mock_filter.call_count == 3


def test_embeddings_healthcheck_resource_embeddings_reports_the_batch_once(mocker):
    """
    A batch sends one alert listing the resources it found, rather than one alert per
    resource, so a batch costs a single slice of the per-run cap
    """
    resources = LearningResourceFactory.create_batch(3, published=True)
    mocker.patch(
        "vector_search.tasks.filter_existing_qdrant_points_by_ids",
        side_effect=_missing_everything,
    )
    mock_log = mocker.patch("vector_search.tasks._sentry_healthcheck_log")

    embeddings_healthcheck_resource_embeddings([lr.id for lr in resources])

    assert mock_log.call_count == 1
    assert mock_log.mock_calls[0].args[1] == "missing_learning_resource_embeddings"
    context = mock_log.mock_calls[0].args[2]
    assert context["count"] == len(resources)
    assert sorted(context["ids"]) == sorted(lr.id for lr in resources)
    # the readable ids identify the resources without needing a lookup from Sentry
    assert sorted(context["readable_ids"]) == sorted(lr.readable_id for lr in resources)


def test_embeddings_healthcheck_resource_embeddings_ignores_present_resources(mocker):
    """
    Only the resources Qdrant is actually missing are reported, so a batch can't
    implicate the resources it merely shared a task with
    """
    present, missing = LearningResourceFactory.create_batch(2, published=True)
    missing_point_ids = [
        vector_point_id(vector_point_key(serialized))
        for serialized in serialize_bulk_learning_resources([missing.id])
    ]
    mocker.patch(
        "vector_search.tasks.filter_existing_qdrant_points_by_ids",
        side_effect=lambda point_ids, **_: [
            p for p in point_ids if p in missing_point_ids
        ],
    )
    mock_log = mocker.patch("vector_search.tasks._sentry_healthcheck_log")

    embeddings_healthcheck_resource_embeddings([present.id, missing.id])

    assert mock_log.call_count == 1
    assert mock_log.mock_calls[0].args[2]["ids"] == [missing.id]


def test_embeddings_healthcheck_reports_both_kinds_of_gap(mocker):
    """
    The two checks together report both the missing content files and the missing
    resource embeddings, each under its own alert type carrying its own ids
    """
    lr = LearningResourceFactory.create(published=True, create_runs=False)
    LearningResourceRunFactory.create(published=True, learning_resource=lr)
    cf = ContentFileFactory.create(run=lr.runs.first(), content="test", published=True)
    mocker.patch(
        "vector_search.tasks.filter_existing_qdrant_points_by_ids",
        side_effect=_missing_everything,
    )
    mock_log = mocker.patch("vector_search.tasks._sentry_healthcheck_log")

    embeddings_healthcheck_content_files([cf.id])
    embeddings_healthcheck_resource_embeddings([lr.id])

    assert mock_log.call_count == 2
    by_alert_type = {call.args[1]: call.args[2] for call in mock_log.mock_calls}
    assert by_alert_type["missing_content_file_embeddings"]["ids"] == [cf.id]
    assert by_alert_type["missing_learning_resource_embeddings"]["ids"] == [lr.id]
    # each alert carries the ids it found rather than a count alone
    for context in by_alert_type.values():
        assert context["count"] == 1


def test_embeddings_healthcheck_content_files_checks_all_runs(mocker):
    """
    A content-file check should check content files from every run, not just best_run
    """
    from vector_search.constants import CONTENT_FILES_COLLECTION_NAME

    lr = LearningResourceFactory.create(published=True, create_runs=False)
    run_a = LearningResourceRunFactory.create(published=True, learning_resource=lr)
    run_b = LearningResourceRunFactory.create(published=True, learning_resource=lr)
    cf_a = ContentFileFactory.create(run=run_a, content="test", published=True)
    cf_b = ContentFileFactory.create(run=run_b, content="test", published=True)

    mocker.patch(
        "vector_search.tasks.filter_existing_qdrant_points_by_ids",
        side_effect=_missing_only(CONTENT_FILES_COLLECTION_NAME),
    )
    mock_log = mocker.patch("vector_search.tasks._sentry_healthcheck_log")

    embeddings_healthcheck_content_files([cf_a.id, cf_b.id])

    assert mock_log.call_count == 1
    assert mock_log.mock_calls[0].args[1] == "missing_content_file_embeddings"
    context = mock_log.mock_calls[0].args[2]
    assert context["count"] == 2
    assert sorted(context["ids"]) == sorted([cf_a.id, cf_b.id])


def test_embeddings_healthcheck_content_files_ignores_files_outside_its_batch(mocker):
    """
    A batch only reports the content files it was given, so sibling tasks can't
    double-report the same content files
    """
    mine = LearningResourceFactory.create(published=True, create_runs=False)
    run_mine = LearningResourceRunFactory.create(published=True, learning_resource=mine)
    my_cf = ContentFileFactory.create(run=run_mine, content="test", published=True)

    theirs = LearningResourceFactory.create(published=True, create_runs=False)
    run_theirs = LearningResourceRunFactory.create(
        published=True, learning_resource=theirs
    )
    other_cf = ContentFileFactory.create(run=run_theirs, content="test", published=True)

    mocker.patch(
        "vector_search.tasks.filter_existing_qdrant_points_by_ids",
        side_effect=_missing_everything,
    )
    mock_log = mocker.patch("vector_search.tasks._sentry_healthcheck_log")

    embeddings_healthcheck_content_files([my_cf.id])

    reported_file_ids = {
        file_id
        for call in mock_log.mock_calls
        for file_id in call.args[2].get("ids", [])
    }
    assert reported_file_ids == {my_cf.id}
    assert other_cf.id not in reported_file_ids


def test_embeddings_healthcheck_sentry_messages_are_count_free(mocker):
    """
    Sentry messages must not interpolate counts or ids, or the per-resource
    reports each become a separate Sentry issue instead of grouped occurrences
    of one. Details live in the context, which is keyed by alert_type.
    """
    lr = LearningResourceFactory.create(published=True, create_runs=False)
    LearningResourceRunFactory.create(published=True, learning_resource=lr)
    cf = ContentFileFactory.create(run=lr.runs.first(), content="test", published=True)
    mocker.patch(
        "vector_search.tasks.filter_existing_qdrant_points_by_ids",
        side_effect=_missing_everything,
    )
    mock_scope = mocker.MagicMock()
    mocker.patch(
        "vector_search.tasks.sentry_sdk.new_scope"
    ).return_value.__enter__.return_value = mock_scope
    mock_capture = mocker.patch("vector_search.tasks.sentry_sdk.capture_message")

    embeddings_healthcheck_content_files([cf.id])
    embeddings_healthcheck_resource_embeddings([lr.id])

    messages = [call.args[0] for call in mock_capture.mock_calls]
    assert set(messages) == {
        "Warning: content files are missing embeddings",
        "Warning: learning resources are missing their embeddings",
    }
    assert not any(char.isdigit() for message in messages for char in message)
    # context key tracks the alert, so resource alerts aren't filed under a
    # content-file key
    context_keys = [call.args[0] for call in mock_scope.set_context.mock_calls]
    assert sorted(context_keys) == [
        "missing_content_file_embeddings",
        "missing_learning_resource_embeddings",
    ]


def test_sentry_healthcheck_log_caps_alerts_per_run(mocker, embed_cache, settings):
    """
    An environment that is simply behind on embedding produces one alert per
    affected resource, so the per-run cap must stop sending after the limit rather
    than spending the whole Sentry quota on one expected condition.
    """
    settings.EMBEDDINGS_HEALTHCHECK_ALERT_CAP = 3
    mock_capture = mocker.patch("vector_search.tasks.sentry_sdk.capture_message")

    for _ in range(10):
        _sentry_healthcheck_log(
            "embeddings", "missing_thing", {"a": 1}, "Warning: thing", run_key="run-1"
        )

    messages = [call.args[0] for call in mock_capture.mock_calls]
    # 3 real alerts, then exactly one notice that the cap engaged, then silence
    assert messages == [
        "Warning: thing",
        "Warning: thing",
        "Warning: thing",
        "Warning: healthcheck alerts suppressed after reaching the per-run cap",
    ]


def test_sentry_healthcheck_log_cap_is_per_alert_type(mocker, embed_cache, settings):
    """
    Each alert type gets its own budget, so a flood of one kind can't hide a
    different kind of failure entirely. A run works through resources for hours, so a
    shared budget would go to whichever check found something first.
    """
    settings.EMBEDDINGS_HEALTHCHECK_ALERT_CAP = 1
    mock_capture = mocker.patch("vector_search.tasks.sentry_sdk.capture_message")

    for _ in range(50):
        _sentry_healthcheck_log(
            "embeddings", "type_a", {}, "Warning: a", run_key="run-1"
        )
    _sentry_healthcheck_log("embeddings", "type_b", {}, "Warning: b", run_key="run-1")

    messages = [call.args[0] for call in mock_capture.mock_calls]
    assert messages.count("Warning: a") == 1
    assert messages.count("Warning: b") == 1


def test_sentry_healthcheck_log_notifies_once_per_capped_type(
    mocker, embed_cache, settings
):
    """
    Each capped type reports that it was capped exactly once, so a capped run is
    never mistaken for a clean one and isn't itself a flood
    """
    settings.EMBEDDINGS_HEALTHCHECK_ALERT_CAP = 1
    mock_capture = mocker.patch("vector_search.tasks.sentry_sdk.capture_message")

    for alert_type in ("type_a", "type_b"):
        for _ in range(5):
            _sentry_healthcheck_log(
                "embeddings", alert_type, {}, f"Warning: {alert_type}", run_key="run-1"
            )

    messages = [call.args[0] for call in mock_capture.mock_calls]
    suppressed = "Warning: healthcheck alerts suppressed after reaching the per-run cap"
    assert messages.count(suppressed) == 2


def test_healthcheck_alert_count_does_not_reset_on_concurrent_create(
    mocker, embed_cache
):
    """
    Workers racing to create a run's counter must not each be handed a count of 1:
    the healthcheck fans out across workers, so a lost count means the cap overshoots
    by however many raced.
    """
    real_incr = embed_cache.incr
    raises_left = 2

    def racing_incr(*args, **kwargs):
        # both racers check the counter before either has created it, so both see it
        # as absent; afterwards the key really does exist
        nonlocal raises_left
        if raises_left:
            raises_left -= 1
            raise ValueError
        return real_incr(*args, **kwargs)

    mocker.patch.object(embed_cache, "incr", side_effect=racing_incr)

    counts = [_healthcheck_alert_count("run-1", "type_a") for _ in range(2)]

    # the racer that won add() counts 1; the loser falls through to a real incr
    # rather than resetting the counter and counting 1 as well
    assert counts == [1, 2]


def test_sentry_healthcheck_log_cap_is_per_run(mocker, embed_cache, settings):
    """
    The budget resets between runs, so a capped run doesn't silence the next one
    """
    settings.EMBEDDINGS_HEALTHCHECK_ALERT_CAP = 1
    mock_capture = mocker.patch("vector_search.tasks.sentry_sdk.capture_message")

    for run_key in ("run-1", "run-2"):
        for _ in range(3):
            _sentry_healthcheck_log(
                "embeddings", "missing_thing", {}, "Warning: thing", run_key=run_key
            )

    messages = [call.args[0] for call in mock_capture.mock_calls]
    assert messages.count("Warning: thing") == 2


@pytest.mark.parametrize("cap", [0, -1])
def test_sentry_healthcheck_log_cap_disabled(mocker, embed_cache, settings, cap):
    """
    A cap of 0 or less disables capping, for environments (production) where a
    large backlog is a real incident rather than expected drift
    """
    settings.EMBEDDINGS_HEALTHCHECK_ALERT_CAP = cap
    mock_capture = mocker.patch("vector_search.tasks.sentry_sdk.capture_message")

    for _ in range(10):
        _sentry_healthcheck_log(
            "embeddings", "missing_thing", {}, "Warning: thing", run_key="run-1"
        )

    assert mock_capture.call_count == 10


def test_sentry_healthcheck_log_uncapped_without_run_key(mocker, embed_cache, settings):
    """
    Callers with no run_key (direct invocations) are uncapped, so the cap can't
    silently swallow one-off checks
    """
    settings.EMBEDDINGS_HEALTHCHECK_ALERT_CAP = 1
    mock_capture = mocker.patch("vector_search.tasks.sentry_sdk.capture_message")

    for _ in range(5):
        _sentry_healthcheck_log("embeddings", "missing_thing", {}, "Warning: thing")

    assert mock_capture.call_count == 5


def test_summaries_healthcheck_missing_summaries(mocker):
    """
    Test summaries_healthcheck for missing contentfile summaries/flashcards
    """
    content_extension = [".srt"]
    content_type = ["file"]
    platform = LearningResourcePlatformFactory.create()
    ContentSummarizerConfigurationFactory.create(
        allowed_extensions=content_extension,
        allowed_content_types=content_type,
        is_active=True,
        llm_model="test",
        platform__code=platform.code,
    )
    resource = LearningResourceFactory.create(
        published=True, require_summaries=True, platform=platform
    )
    resource.runs.all().delete()
    learning_resource_run = LearningResourceRunFactory.create(
        published=True,
        learning_resource=resource,
    )
    learning_resource_run.learning_resource = resource
    learning_resource_run.save()

    ContentFileFactory.create(
        published=True,
        content="test",
        file_extension=content_extension[0],
        summary="",
        content_type=content_type[0],
        run=learning_resource_run,
    )
    mocker.patch(
        "vector_search.tasks.filter_existing_qdrant_points_by_ids",
    )
    mock_sentry = mocker.patch("vector_search.tasks.sentry_sdk.capture_message")

    summaries_healthcheck()
    assert mock_sentry.call_count == 1
    assert (
        mock_sentry.mock_calls[0].args[0]
        == "Warning: missing content file summaries detected"
    )


def test_summaries_healthcheck_excludes_already_summarized(mocker):
    """
    summaries_healthcheck should not count content files that already have
    a summary as missing (regression test for passing overwrite=True
    implicitly by mis-ordering get_unprocessed_content_file_ids arguments)
    """
    content_extension = [".srt"]
    content_type = ["file"]
    platform = LearningResourcePlatformFactory.create()
    ContentSummarizerConfigurationFactory.create(
        allowed_extensions=content_extension,
        allowed_content_types=content_type,
        is_active=True,
        llm_model="test",
        platform__code=platform.code,
    )
    resource = LearningResourceFactory.create(
        published=True, require_summaries=True, platform=platform
    )
    resource.runs.all().delete()
    learning_resource_run = LearningResourceRunFactory.create(
        published=True,
        learning_resource=resource,
    )
    learning_resource_run.learning_resource = resource
    learning_resource_run.save()

    ContentFileFactory.create(
        published=True,
        content="test",
        file_extension=content_extension[0],
        summary="already summarized",
        flashcards=[{"question": "q", "answer": "a"}],
        content_type=content_type[0],
        run=learning_resource_run,
    )
    mocker.patch(
        "vector_search.tasks.filter_existing_qdrant_points_by_ids",
    )
    mock_sentry = mocker.patch("vector_search.tasks.sentry_sdk.capture_message")

    summaries_healthcheck()
    assert mock_sentry.call_count == 0


def test_summaries_healthcheck_scoped_to_require_summaries(mocker):
    """
    summaries_healthcheck should only count missing summaries for learning
    resources that require them, not every learning resource (regression
    test for get_unprocessed_content_file_ids never receiving
    learning_resource_ids)
    """
    content_extension = [".srt"]
    content_type = ["file"]
    platform = LearningResourcePlatformFactory.create()
    ContentSummarizerConfigurationFactory.create(
        allowed_extensions=content_extension,
        allowed_content_types=content_type,
        is_active=True,
        llm_model="test",
        platform__code=platform.code,
    )
    resource = LearningResourceFactory.create(
        published=True, require_summaries=False, platform=platform
    )
    resource.runs.all().delete()
    learning_resource_run = LearningResourceRunFactory.create(
        published=True,
        learning_resource=resource,
    )
    learning_resource_run.learning_resource = resource
    learning_resource_run.save()

    ContentFileFactory.create(
        published=True,
        content="test",
        file_extension=content_extension[0],
        summary="",
        content_type=content_type[0],
        run=learning_resource_run,
    )
    mocker.patch(
        "vector_search.tasks.filter_existing_qdrant_points_by_ids",
    )
    mock_sentry = mocker.patch("vector_search.tasks.sentry_sdk.capture_message")

    summaries_healthcheck()
    assert mock_sentry.call_count == 0


def test_generate_embeddings_retries_on_deadline(mocker):
    """A deadline with retry budget left calls self.retry (jittered backoff)."""
    mocker.patch(
        "vector_search.tasks.embed_learning_resources",
        side_effect=_rpc_error(grpc.StatusCode.DEADLINE_EXCEEDED),
    )
    retry = mocker.patch.object(generate_embeddings, "retry", side_effect=Retry())
    with pytest.raises(Retry):
        generate_embeddings([1], CONTENT_FILE_TYPE, overwrite=True, failure_key="k")
    retry.assert_called_once()
    assert retry.call_args.kwargs["countdown"] >= 0


def test_generate_embeddings_retries_on_unavailable(mocker):
    """UNAVAILABLE (e.g. 502 from a throttled qdrant node) retries like a deadline."""
    mocker.patch(
        "vector_search.tasks.embed_learning_resources",
        side_effect=_rpc_error(grpc.StatusCode.UNAVAILABLE),
    )
    retry = mocker.patch.object(generate_embeddings, "retry", side_effect=Retry())
    with pytest.raises(Retry):
        generate_embeddings([1], CONTENT_FILE_TYPE, overwrite=True, failure_key="k")
    retry.assert_called_once()


def test_retry_countdown_is_minutes_scale(mocker):
    """Backoff is jittered exponential at minutes scale, capped at 10m."""
    backoff = mocker.patch(
        "vector_search.tasks.get_exponential_backoff_interval", return_value=42
    )
    assert _retry_countdown(2) == 42
    backoff.assert_called_once_with(
        factor=120, retries=2, maximum=600, full_jitter=True
    )


def test_generate_embeddings_records_on_exhaustion(mocker):
    """Exhausted deadline + failure_key: record + return, do not raise (chain continues)."""
    mocker.patch(
        "vector_search.tasks.embed_learning_resources",
        side_effect=_rpc_error(grpc.StatusCode.DEADLINE_EXCEEDED),
    )
    record = mocker.patch("vector_search.tasks._record_embedding_failure")
    generate_embeddings.push_request(retries=3)
    try:
        assert (
            generate_embeddings([1], CONTENT_FILE_TYPE, overwrite=True, failure_key="k")
            is None
        )
    finally:
        generate_embeddings.pop_request()
    record.assert_called_once_with("k")


def test_generate_embeddings_records_non_transient_with_key(mocker):
    """Non-transient error + failure_key: record + return, do not raise."""
    mocker.patch(
        "vector_search.tasks.embed_learning_resources", side_effect=ValueError("boom")
    )
    record = mocker.patch("vector_search.tasks._record_embedding_failure")
    assert (
        generate_embeddings([1], CONTENT_FILE_TYPE, overwrite=True, failure_key="k")
        is None
    )
    record.assert_called_once_with("k")


def test_generate_embeddings_reraises_other_grpc_errors(mocker):
    """Non-transient gRPC errors propagate (task fails) rather than retrying."""
    mocker.patch(
        "vector_search.tasks.embed_learning_resources",
        side_effect=_rpc_error(grpc.StatusCode.INVALID_ARGUMENT),
    )
    with pytest.raises(grpc.RpcError):
        generate_embeddings([1], COURSE_TYPE, overwrite=False)


def test_generate_embeddings_does_not_swallow_errors(mocker):
    """Unhandled errors propagate so the task fails instead of reporting success."""
    mocker.patch(
        "vector_search.tasks.embed_learning_resources",
        side_effect=ValueError("boom"),
    )
    with pytest.raises(ValueError, match="boom"):
        generate_embeddings([1], COURSE_TYPE, overwrite=False)


def test_remove_embeddings_raises_retryerror_on_grpc_deadline(mocker):
    """remove_embeddings retries on DEADLINE_EXCEEDED rather than swallowing it."""
    mocker.patch(
        "vector_search.tasks.remove_qdrant_records",
        side_effect=_rpc_error(grpc.StatusCode.DEADLINE_EXCEEDED),
    )
    with pytest.raises(RetryError):
        remove_embeddings([1], COURSE_TYPE)


def test_remove_embeddings_reraises_other_grpc_errors(mocker):
    """Non-transient gRPC errors propagate (task fails) rather than retrying."""
    mocker.patch(
        "vector_search.tasks.remove_qdrant_records",
        side_effect=_rpc_error(grpc.StatusCode.INVALID_ARGUMENT),
    )
    with pytest.raises(grpc.RpcError):
        remove_embeddings([1], COURSE_TYPE)


def test_remove_embeddings_does_not_swallow_errors(mocker):
    """Unhandled errors propagate so the task fails instead of reporting success."""
    mocker.patch(
        "vector_search.tasks.remove_qdrant_records",
        side_effect=ValueError("boom"),
    )
    with pytest.raises(ValueError, match="boom"):
        remove_embeddings([1], COURSE_TYPE)


def test_record_embedding_failure_increments(embed_cache):
    _record_embedding_failure("run-1")
    _record_embedding_failure("run-1")
    assert embed_cache.get("embed_errors:run-1") == 2


def test_finalize_embeddings_raises_and_clears_on_failures(embed_cache):
    embed_cache.set("embed_errors:run-1", 3)
    with pytest.raises(RuntimeError, match="3 embedding chunk"):
        finalize_embeddings("run-1")
    assert embed_cache.get("embed_errors:run-1") is None


def test_finalize_embeddings_succeeds_when_clean(embed_cache):
    assert finalize_embeddings("run-1") is None
    assert embed_cache.get("embed_errors:run-1") is None
