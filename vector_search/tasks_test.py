import datetime
import random

import grpc
import pytest
from django.conf import settings
from django.core.cache.backends.locmem import LocMemCache

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
from main.utils import now_in_utc
from vector_search.tasks import (
    _record_embedding_failure,
    embed_learning_resources_by_id,
    embed_new_content_files,
    embed_new_learning_resources,
    embed_run_content_files,
    embeddings_healthcheck,
    finalize_embeddings,
    generate_embeddings,
    remove_embeddings,
    remove_run_content_files,
    remove_unpublished_run_content_files,
    start_embed_resources,
)
from vector_search.utils import vector_point_id

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

    with pytest.raises(mocked_celery.replace_exception_class):
        embed_new_content_files.delay()

    embedded_ids = generate_embeddings_mock.si.mock_calls[0].args[0]
    assert sorted(new_content_file_ids) == sorted(embedded_ids)
    assert mocked_celery.chain.call_args.args == tuple(
        generate_embeddings_mock.si.return_value
        for _ in generate_embeddings_mock.si.mock_calls
    )


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
        content_file.id for content_file in ContentFileFactory.create_batch(3, run=run)
    ]
    ContentFileFactory.create()
    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
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
        and mock_call.kwargs == {"overwrite": True}
        for mock_call in generate_embeddings_mock.si.mock_calls
    )
    assert mocked_celery.chain.call_args.args == tuple(
        generate_embeddings_mock.si.return_value
        for _ in generate_embeddings_mock.si.mock_calls
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


def test_embeddings_healthcheck_no_missing_embeddings(mocker):
    """
    Test embeddings_healthcheck when there are no missing embeddings
    """
    lr = LearningResourceFactory.create(published=True)
    LearningResourceRunFactory.create(published=True, learning_resource=lr)
    ContentFileFactory.create(run=lr.runs.first(), content="test", published=True)
    mock_sentry = mocker.patch("vector_search.tasks.sentry_sdk", autospec=True)
    mocker.patch(
        "vector_search.tasks.filter_existing_qdrant_points_by_ids", return_value=[]
    )

    embeddings_healthcheck()
    assert mock_sentry.capture_message.call_count == 0


def test_embeddings_healthcheck_missing_both(mocker):
    """
    Test embeddings_healthcheck when there are missing content files and learning resources
    """
    lr = LearningResourceFactory.create(published=True, create_runs=False)
    LearningResourceRunFactory.create(published=True, learning_resource=lr)
    cf = ContentFileFactory.create(run=lr.runs.first(), content="test", published=True)
    mocker.patch(
        "vector_search.tasks.filter_existing_qdrant_points_by_ids",
        side_effect=[
            [vector_point_id(lr.readable_id)],
            [
                vector_point_id(
                    f"{cf.run.learning_resource.id}.{cf.run.run_id}.{cf.key}.0"
                )
            ],
        ],
    )
    mock_sentry = mocker.patch("vector_search.tasks.sentry_sdk.capture_message")

    embeddings_healthcheck()

    assert mock_sentry.call_count == 2


def test_embeddings_healthcheck_checks_all_runs(mocker):
    """
    embeddings_healthcheck should check content files from every run, not just best_run
    """
    from vector_search.constants import CONTENT_FILES_COLLECTION_NAME

    lr = LearningResourceFactory.create(published=True, create_runs=False)
    run_a = LearningResourceRunFactory.create(published=True, learning_resource=lr)
    run_b = LearningResourceRunFactory.create(published=True, learning_resource=lr)
    ContentFileFactory.create(run=run_a, content="test", published=True)
    ContentFileFactory.create(run=run_b, content="test", published=True)

    def fake_filter(batch, collection_name=None):
        # report every content file point as missing, no missing resources
        return list(batch) if collection_name == CONTENT_FILES_COLLECTION_NAME else []

    mocker.patch(
        "vector_search.tasks.filter_existing_qdrant_points_by_ids",
        side_effect=fake_filter,
    )
    mock_sentry = mocker.patch("vector_search.tasks.sentry_sdk.capture_message")

    embeddings_healthcheck()

    assert (
        mock_sentry.mock_calls[0].args[0]
        == "Warning: 2 missing content file embeddings detected"
    )


def test_embeddings_healthcheck_missing_summaries(mocker):
    """
    Test embeddings_healthcheck for missing contentfile summaries/flashcards
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

    embeddings_healthcheck()
    assert mock_sentry.call_count == 1
    assert (
        mock_sentry.mock_calls[0].args[0]
        == "Warning: 1 missing content file summaries detected"
    )


def test_generate_embeddings_raises_retryerror_on_grpc_deadline(mocker):
    """A DEADLINE_EXCEEDED gRPC error becomes a RetryError (autoretry_for picks it up)."""
    mocker.patch(
        "vector_search.tasks.embed_learning_resources",
        side_effect=_rpc_error(grpc.StatusCode.DEADLINE_EXCEEDED),
    )
    with pytest.raises(RetryError):
        generate_embeddings([1], COURSE_TYPE, overwrite=False)


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
