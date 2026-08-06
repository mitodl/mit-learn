"""Search task tests"""

from collections import OrderedDict

import pytest
from celery.exceptions import Ignore, Retry
from django.conf import settings
from django.contrib.auth import get_user_model
from opensearchpy.exceptions import ConnectionError as ESConnectionError
from opensearchpy.exceptions import ConnectionTimeout, RequestError

from learning_resources.etl.constants import RESOURCE_FILE_ETL_SOURCES, ETLSource
from learning_resources.factories import (
    ContentFileFactory,
    CourseFactory,
    LearningResourceDepartmentFactory,
    LearningResourceFactory,
    LearningResourceOfferorFactory,
    LearningResourceTopicFactory,
    ProgramFactory,
)
from learning_resources.models import LearningResource
from learning_resources.views import FeaturedViewSet
from learning_resources_search.api import gen_content_file_id
from learning_resources_search.constants import (
    CONTENT_FILE_TYPE,
    COURSE_TYPE,
    HYBRID_COMBINED_INDEX,
    LEARNING_RESOURCE_TYPES,
    PERCOLATE_INDEX_TYPE,
    PROGRAM_TYPE,
    REINDEX_TASK_NAME,
    IndexestoUpdate,
    ReindexBatchKind,
)
from learning_resources_search.exceptions import ReindexError, RetryError
from learning_resources_search.factories import PercolateQueryFactory
from learning_resources_search.models import PercolateQuery
from learning_resources_search.serializers import (
    serialize_content_file_for_update,
    serialize_learning_resource_for_update,
)
from learning_resources_search.tasks import (
    _generate_subscription_digest_subject,
    _get_percolated_rows,
    _group_percolated_rows,
    _infer_percolate_group,
    _validated_resource_image_url,
    _maybe_finish_reindex_job,
    bulk_deindex_learning_resources,
    deindex_document,
    deindex_run_content_files,
    finish_reindex_job,
    index_learning_resources,
    index_run_content_files,
    run_reindex_batch,
    send_subscription_emails,
    start_recreate_index,
    start_update_index,
    update_featured_rank,
    upsert_content_file,
    upsert_learning_resource,
    wrap_retry_exception,
)
from main.factories import TaskBatchFactory, TaskJobFactory, UserFactory
from main.models import TaskBatch, TaskJob
from main.test_utils import assert_not_raises
from main.utils import frontend_absolute_url

pytestmark = pytest.mark.django_db
User = get_user_model()


@pytest.fixture
def _wrap_retry_mock(mocker):
    """
    Patches the wrap_retry_exception context manager and asserts that it was
    called by any test that uses it
    """
    wrap_mock = mocker.patch("learning_resources_search.tasks.wrap_retry_exception")
    yield
    wrap_mock.assert_called_once()


@pytest.fixture
def mocked_api(mocker):
    """Mock object that patches the channels API"""
    return mocker.patch("learning_resources_search.tasks.api")


@pytest.fixture(autouse=True)
def mock_image_url_is_reachable(mocker):
    """Mock the image URL reachability check to avoid network requests"""
    return mocker.patch(
        "learning_resources_search.tasks.image_url_is_reachable", return_value=True
    )


def test_upsert_learning_resource(mocked_api):
    """Test that upsert_learning_resourc will serialize the learning resource data and upsert it to the OS index"""
    resource = LearningResourceFactory.create()
    upsert_learning_resource(resource.id)
    data = serialize_learning_resource_for_update(
        LearningResource.objects.for_search_serialization().get(id=resource.id)
    )
    mocked_api.upsert_document.assert_called_once_with(
        resource.id,
        data,
        resource.resource_type,
        retry_on_conflict=settings.INDEXING_ERROR_RETRIES,
    )


@pytest.mark.parametrize("error", [KeyError, RequestError])
def test_wrap_retry_exception(error):
    """wrap_retry_exception should raise RetryError when other exceptions are raised"""
    with assert_not_raises(), wrap_retry_exception(error):
        # Should not raise an exception
        pass


@pytest.mark.parametrize("matching", [True, False])
def test_wrap_retry_exception_matching(matching):
    """A matching exception should raise a RetryError"""

    def raise_thing():
        """Raise the exception"""
        if matching:
            msg = "err"
            raise ConnectionTimeout(msg, "err", "err")
        else:
            raise TabError

    matching_exception = RetryError if matching else TabError
    with pytest.raises(matching_exception), wrap_retry_exception(ESConnectionError):
        raise_thing()


def test_system_exit_retry(mocker):
    """Task should raise a retry error on system exit"""
    mocker.patch(
        "learning_resources_search.tasks.wrap_retry_exception", side_effect=SystemExit
    )
    with pytest.raises(Retry) as exc:
        index_learning_resources.delay(
            [1], COURSE_TYPE, IndexestoUpdate.current_index.value
        )
    assert str(exc.value.args[1]) == "SystemExit"


@pytest.mark.parametrize(
    "indexes",
    [
        ["course"],
        ["program"],
        ["combined_hybrid"],
    ],
)
def test_start_recreate_index(mocker, indexes):  # noqa: C901, PLR0912, PLR0915
    """
    recreate_index should create backing indexes and batch rows for all data
    """
    settings.OPENSEARCH_INDEXING_CHUNK_SIZE = 2
    settings.OPENSEARCH_DOCUMENT_INDEXING_CHUNK_SIZE = 2
    settings.OPENSEARCH_REINDEX_DISPATCH_CHUNK_SIZE = 2

    mock_blocklist = mocker.patch(
        "learning_resources_search.tasks.load_course_blocklist", return_value=[]
    )

    ocw_courses = sorted(
        CourseFactory.create_batch(4, etl_source=ETLSource.ocw.value),
        key=lambda course: course.learning_resource_id,
    )

    for course in ocw_courses:
        ContentFileFactory.create_batch(3, run=course.learning_resource.runs.first())

    oll_courses = CourseFactory.create_batch(2, etl_source=ETLSource.ocw.value)

    courses = sorted(
        list(oll_courses) + list(ocw_courses),
        key=lambda course: course.learning_resource_id,
    )

    programs = sorted(
        ProgramFactory.create_batch(
            4,
            courses=[],
        ),
        key=lambda program: program.learning_resource_id,
    )

    run_reindex_batch_mock = mocker.patch(
        "learning_resources_search.tasks.run_reindex_batch", autospec=True
    )

    backing_index = "backing"
    create_backing_index_mock = mocker.patch(
        "learning_resources_search.indexing_api.create_backing_index",
        autospec=True,
        return_value=backing_index,
    )
    mocker.patch(
        "learning_resources_search.indexing_api.get_existing_reindexing_indexes",
        autospec=True,
        return_value=[],
    )
    delete_orphaned_indexes_mock = mocker.patch(
        "learning_resources_search.indexing_api.delete_orphaned_indexes", autospec=True
    )

    job = TaskJobFactory.create(
        task_name=REINDEX_TASK_NAME, params={"indexes": indexes}
    )
    start_recreate_index.delay(job.id)

    job.refresh_from_db()
    assert job.status == TaskJob.Status.RUNNING
    assert job.error == ""

    for doctype in [COURSE_TYPE, PROGRAM_TYPE, HYBRID_COMBINED_INDEX]:
        if doctype in indexes:
            assert job.params["backing_indexes"][doctype] == backing_index
            create_backing_index_mock.assert_any_call(doctype)

    delete_orphaned_indexes_mock.assert_called_once_with(
        indexes, delete_reindexing_tags=False
    )

    resource_batches = job.batches.filter(
        kind=ReindexBatchKind.learning_resources.value
    ).order_by("id")
    dispatch_batches = job.batches.filter(
        kind=ReindexBatchKind.dispatch_content_files.value
    ).order_by("id")

    # no content file batches until dispatch batches run
    assert not job.batches.filter(kind=ReindexBatchKind.content_files.value).exists()

    if COURSE_TYPE in indexes:
        assert resource_batches.count() == 3

    if PROGRAM_TYPE in indexes:
        assert resource_batches.count() == 2

    if HYBRID_COMBINED_INDEX in indexes:
        assert resource_batches.count() == 5

    resource_id_chunks = [batch.params["ids"] for batch in resource_batches]
    for batch in resource_batches:
        assert batch.params["index_name"] == indexes[0]

    if COURSE_TYPE in indexes or HYBRID_COMBINED_INDEX in indexes:
        mock_blocklist.assert_called_once()
        for chunk in (
            [courses[0].learning_resource_id, courses[1].learning_resource_id],
            [courses[2].learning_resource_id, courses[3].learning_resource_id],
            [courses[4].learning_resource_id, courses[5].learning_resource_id],
        ):
            assert chunk in resource_id_chunks

    if PROGRAM_TYPE in indexes or HYBRID_COMBINED_INDEX in indexes:
        for chunk in (
            [programs[0].learning_resource_id, programs[1].learning_resource_id],
            [programs[2].learning_resource_id, programs[3].learning_resource_id],
        ):
            assert chunk in resource_id_chunks

    if COURSE_TYPE in indexes:
        # all 6 courses are resource-file (ocw) courses, dispatched in chunks of 2
        assert dispatch_batches.count() == 3
        dispatched_ids = [
            resource_id
            for batch in dispatch_batches
            for resource_id in batch.params["learning_resource_ids"]
        ]
        assert dispatched_ids == [course.learning_resource_id for course in courses]
        for batch in dispatch_batches:
            assert batch.params["resource_type"] == COURSE_TYPE
    elif PROGRAM_TYPE in indexes:
        assert dispatch_batches.count() == 2
        dispatched_ids = [
            resource_id
            for batch in dispatch_batches
            for resource_id in batch.params["learning_resource_ids"]
        ]
        assert dispatched_ids == [program.learning_resource_id for program in programs]
        for batch in dispatch_batches:
            assert batch.params["resource_type"] == PROGRAM_TYPE
    else:
        assert dispatch_batches.count() == 0

    # every batch was enqueued
    assert run_reindex_batch_mock.delay.call_count == job.batches.count()
    enqueued_ids = {
        call.args[0] for call in run_reindex_batch_mock.delay.call_args_list
    }
    assert enqueued_ids == set(job.batches.values_list("id", flat=True))


@pytest.mark.parametrize("indexes", [["course"], ["combined_hybrid"]])
def test_start_recreate_index_excludes_blocklisted_courses(mocker, indexes):
    """start_recreate_index should not index courses whose readable_id is blocklisted"""
    courses = CourseFactory.create_batch(3, etl_source=ETLSource.ocw.value)
    blocked = courses[0]
    for course in courses:
        ContentFileFactory.create_batch(2, run=course.learning_resource.runs.first())
    mocker.patch(
        "learning_resources_search.tasks.load_course_blocklist",
        return_value=[blocked.learning_resource.readable_id],
    )
    mocker.patch("learning_resources_search.tasks.run_reindex_batch", autospec=True)
    mocker.patch(
        "learning_resources_search.indexing_api.get_existing_reindexing_indexes",
        autospec=True,
        return_value=[],
    )
    # ponytail: no assertions on these; they just keep the task off OpenSearch
    # (create_backing_index must return a string so it can be stored in the
    # job's JSON params)
    mocker.patch(
        "learning_resources_search.indexing_api.create_backing_index",
        autospec=True,
        return_value="backing",
    )
    mocker.patch(
        "learning_resources_search.indexing_api.delete_orphaned_indexes",
        autospec=True,
    )

    job = TaskJobFactory.create(
        task_name=REINDEX_TASK_NAME, params={"indexes": indexes}
    )
    start_recreate_index.delay(job.id)

    job.refresh_from_db()
    assert job.status == TaskJob.Status.RUNNING

    indexed_resource_ids = {
        resource_id
        for batch in job.batches.filter(kind=ReindexBatchKind.learning_resources.value)
        for resource_id in batch.params["ids"]
    }
    assert indexed_resource_ids == {
        course.learning_resource_id for course in courses[1:]
    }

    if COURSE_TYPE in indexes:
        dispatched_ids = {
            resource_id
            for batch in job.batches.filter(
                kind=ReindexBatchKind.dispatch_content_files.value
            )
            for resource_id in batch.params["learning_resource_ids"]
        }
        assert dispatched_ids == {course.learning_resource_id for course in courses[1:]}


def test_start_recreate_index_percolate(mocker):
    """start_recreate_index should chunk and enqueue percolate query batches"""
    settings.OPENSEARCH_INDEXING_CHUNK_SIZE = 2

    PercolateQuery.objects.bulk_create(PercolateQueryFactory.build_batch(5))
    percolate_queries = list(PercolateQuery.objects.order_by("id"))

    run_reindex_batch_mock = mocker.patch(
        "learning_resources_search.tasks.run_reindex_batch", autospec=True
    )
    mocker.patch(
        "learning_resources_search.indexing_api.create_backing_index",
        autospec=True,
        return_value="backing",
    )
    mocker.patch(
        "learning_resources_search.indexing_api.get_existing_reindexing_indexes",
        autospec=True,
        return_value=[],
    )
    mocker.patch(
        "learning_resources_search.indexing_api.delete_orphaned_indexes", autospec=True
    )

    job = TaskJobFactory.create(
        task_name=REINDEX_TASK_NAME, params={"indexes": [PERCOLATE_INDEX_TYPE]}
    )
    start_recreate_index.delay(job.id)

    job.refresh_from_db()
    assert job.status == TaskJob.Status.RUNNING

    percolate_batches = job.batches.filter(
        kind=ReindexBatchKind.percolate.value
    ).order_by("batch_key")
    # 5 queries in chunks of 2 -> 3 batches, and only percolate batches
    assert percolate_batches.count() == 3
    assert job.batches.count() == 3

    id_chunks = [batch.params["ids"] for batch in percolate_batches]
    assert id_chunks == [
        [percolate_queries[0].id, percolate_queries[1].id],
        [percolate_queries[2].id, percolate_queries[3].id],
        [percolate_queries[4].id],
    ]

    # every percolate batch was enqueued
    enqueued_ids = {
        call.args[0] for call in run_reindex_batch_mock.delay.call_args_list
    }
    assert enqueued_ids == set(percolate_batches.values_list("id", flat=True))


@pytest.mark.parametrize(
    "restart",
    [True, False],
)
def test_start_recreate_index_existing_reindexing_index(mocker, restart):
    """start_recreate_index should stop when reindexing indexes already exist."""
    settings.OPENSEARCH_INDEXING_CHUNK_SIZE = 2
    settings.OPENSEARCH_DOCUMENT_INDEXING_CHUNK_SIZE = 2
    settings.OPENSEARCH_REINDEX_DISPATCH_CHUNK_SIZE = 2
    indexes = ["program"]

    programs = sorted(
        ProgramFactory.create_batch(4),
        key=lambda program: program.learning_resource_id,
    )

    run_reindex_batch_mock = mocker.patch(
        "learning_resources_search.tasks.run_reindex_batch", autospec=True
    )

    backing_index = "backing"
    mocker.patch(
        "learning_resources_search.indexing_api.create_backing_index",
        autospec=True,
        return_value=backing_index,
    )
    delete_orphaned_indexes_mock = mocker.patch(
        "learning_resources_search.indexing_api.delete_orphaned_indexes", autospec=True
    )

    mocker.patch(
        "learning_resources_search.indexing_api.get_existing_reindexing_indexes",
        autospec=True,
        return_value=["another_reindexing_index"],
    )

    job = TaskJobFactory.create(
        task_name=REINDEX_TASK_NAME,
        params={
            "indexes": indexes,
            "restart": restart,
        },
    )
    start_recreate_index.delay(job.id)

    job.refresh_from_db()

    if restart:
        assert job.status == TaskJob.Status.RUNNING
        delete_orphaned_indexes_mock.assert_called_once_with(
            indexes, delete_reindexing_tags=True
        )
        assert job.params["backing_indexes"] == {"program": "backing"}

        resource_batches = job.batches.filter(
            kind=ReindexBatchKind.learning_resources.value
        )
        assert resource_batches.count() == 2
        resource_id_chunks = [batch.params["ids"] for batch in resource_batches]
        for chunk in (
            [programs[0].learning_resource_id, programs[1].learning_resource_id],
            [programs[2].learning_resource_id, programs[3].learning_resource_id],
        ):
            assert chunk in resource_id_chunks
        assert run_reindex_batch_mock.delay.call_count == job.batches.count()
    else:
        assert job.status == TaskJob.Status.FAILED
        assert "another_reindexing_index" in job.error
        assert job.batches.count() == 0
        assert run_reindex_batch_mock.delay.call_count == 0
        delete_orphaned_indexes_mock.assert_not_called()


def test_start_recreate_index_existing_active_job(mocker):
    """start_recreate_index should stop when another active reindex job overlaps"""
    mocker.patch(
        "learning_resources_search.indexing_api.get_existing_reindexing_indexes",
        autospec=True,
        return_value=[],
    )
    run_reindex_batch_mock = mocker.patch(
        "learning_resources_search.tasks.run_reindex_batch", autospec=True
    )
    other_job = TaskJobFactory.create(
        task_name=REINDEX_TASK_NAME,
        params={"indexes": ["program"]},
        status=TaskJob.Status.RUNNING,
    )
    job = TaskJobFactory.create(
        task_name=REINDEX_TASK_NAME, params={"indexes": ["program"]}
    )

    start_recreate_index.delay(job.id)

    job.refresh_from_db()
    assert job.status == TaskJob.Status.FAILED
    assert str(other_job.id) in job.error
    assert run_reindex_batch_mock.delay.call_count == 0


def test_start_recreate_index_resumes_running_job(mocker):
    """
    A redelivery of start_recreate_index for a RUNNING job (worker died mid
    enqueue loop) should re-enqueue still-queued batches without redoing setup
    """
    create_backing_index_mock = mocker.patch(
        "learning_resources_search.indexing_api.create_backing_index", autospec=True
    )
    delete_orphaned_indexes_mock = mocker.patch(
        "learning_resources_search.indexing_api.delete_orphaned_indexes", autospec=True
    )
    run_reindex_batch_mock = mocker.patch(
        "learning_resources_search.tasks.run_reindex_batch", autospec=True
    )
    finish_mock = mocker.patch(
        "learning_resources_search.tasks.finish_reindex_job", autospec=True
    )

    job = TaskJobFactory.create(
        task_name=REINDEX_TASK_NAME,
        params={"indexes": ["course"], "backing_indexes": {"course": "backing"}},
        status=TaskJob.Status.RUNNING,
    )
    # one batch already finished in the first attempt, one never got enqueued
    done_batch = TaskBatchFactory.create(
        job=job,
        kind=ReindexBatchKind.learning_resources.value,
        status=TaskBatch.Status.SUCCEEDED,
    )
    stranded_batch = TaskBatchFactory.create(
        job=job,
        kind=ReindexBatchKind.learning_resources.value,
        status=TaskBatch.Status.QUEUED,
    )

    start_recreate_index.delay(job.id)

    # setup must NOT be redone (recreating backing indexes would orphan the
    # documents the finished batch already wrote)
    create_backing_index_mock.assert_not_called()
    delete_orphaned_indexes_mock.assert_not_called()
    # only the still-queued batch is (re)enqueued
    run_reindex_batch_mock.delay.assert_called_once_with(stranded_batch.id)
    # no new batch rows created
    assert job.batches.count() == 2
    assert done_batch.job_id == job.id
    # job is not complete yet (a queued batch remains), so finish isn't claimed
    finish_mock.delay.assert_not_called()


@pytest.mark.parametrize("with_error", [True, False])
def test_finish_reindex_job(mocker, with_error):
    """
    finish_reindex_job should attach the backing index to the default alias
    """
    job = TaskJobFactory.create(
        task_name=REINDEX_TASK_NAME,
        params={
            "indexes": ["course", "program"],
            "backing_indexes": {"course": "backing", "program": "backing"},
        },
        status=TaskJob.Status.FINISHING,
    )
    TaskBatchFactory.create(job=job, status=TaskBatch.Status.SUCCEEDED)
    if with_error:
        TaskBatchFactory.create(job=job, status=TaskBatch.Status.FAILED, error="error")
    switch_indices_mock = mocker.patch(
        "learning_resources_search.indexing_api.switch_indices", autospec=True
    )
    mock_delete_orphans = mocker.patch(
        "learning_resources_search.indexing_api.delete_orphaned_indexes"
    )
    mocker.patch(
        "learning_resources_search.indexing_api.is_default_backing_index",
        autospec=True,
        return_value=False,
    )

    if with_error:
        with pytest.raises(ReindexError):
            finish_reindex_job.delay(job.id)
        switch_indices_mock.assert_not_called()
        mock_delete_orphans.assert_called_once()
        job.refresh_from_db()
        assert job.status == TaskJob.Status.FAILED
        assert "error" in job.error
    else:
        finish_reindex_job.delay(job.id)
        switch_indices_mock.assert_any_call("backing", COURSE_TYPE)
        switch_indices_mock.assert_any_call("backing", PROGRAM_TYPE)
        mock_delete_orphans.assert_not_called()
        job.refresh_from_db()
        assert job.status == TaskJob.Status.SUCCEEDED


def test_finish_reindex_job_skips_already_switched(mocker):
    """
    A redelivered finish_reindex_job should not re-switch (and thereby delete)
    a backing index that is already the default
    """
    job = TaskJobFactory.create(
        task_name=REINDEX_TASK_NAME,
        params={"indexes": ["course"], "backing_indexes": {"course": "backing"}},
        status=TaskJob.Status.FINISHING,
    )
    switch_indices_mock = mocker.patch(
        "learning_resources_search.indexing_api.switch_indices", autospec=True
    )
    mocker.patch(
        "learning_resources_search.indexing_api.is_default_backing_index",
        autospec=True,
        return_value=True,
    )

    finish_reindex_job.delay(job.id)

    switch_indices_mock.assert_not_called()
    job.refresh_from_db()
    assert job.status == TaskJob.Status.SUCCEEDED


def test_finish_reindex_job_noop_when_not_finishing(mocker):
    """finish_reindex_job should do nothing unless the job is in finishing state"""
    job = TaskJobFactory.create(
        task_name=REINDEX_TASK_NAME,
        params={"indexes": ["course"], "backing_indexes": {"course": "backing"}},
        status=TaskJob.Status.SUCCEEDED,
    )
    switch_indices_mock = mocker.patch(
        "learning_resources_search.indexing_api.switch_indices", autospec=True
    )

    finish_reindex_job.delay(job.id)

    switch_indices_mock.assert_not_called()


@pytest.mark.parametrize("with_error", [True, False])
def test_finish_reindex_job_retry_exceptions(mocker, with_error):
    """
    finish_reindex_job should be retried on RequestErrors
    """
    job = TaskJobFactory.create(
        task_name=REINDEX_TASK_NAME,
        params={
            "indexes": ["course", "program"],
            "backing_indexes": {"course": "backing", "program": "backing"},
        },
        status=TaskJob.Status.FINISHING,
    )
    if with_error:
        TaskBatchFactory.create(job=job, status=TaskBatch.Status.FAILED, error="error")
    mock_error = RequestError(429, "oops", {})
    switch_indices_mock = mocker.patch(
        "learning_resources_search.indexing_api.switch_indices",
        autospec=True,
        side_effect=[mock_error, None],
    )
    mock_delete_orphans = mocker.patch(
        "learning_resources_search.indexing_api.delete_orphaned_indexes",
        side_effect=[mock_error, None],
    )
    mocker.patch(
        "learning_resources_search.indexing_api.is_default_backing_index",
        autospec=True,
        return_value=False,
    )

    with pytest.raises(Retry):
        finish_reindex_job.delay(job.id)
    job.refresh_from_db()
    # the job stays in finishing state so the retry can pick it back up
    assert job.status == TaskJob.Status.FINISHING
    if with_error:
        switch_indices_mock.assert_not_called()
        mock_delete_orphans.assert_called_once()
    else:
        mock_delete_orphans.assert_not_called()
        switch_indices_mock.assert_called_once()


def test_run_reindex_batch_learning_resources(mocker, mocked_api):
    """run_reindex_batch should index learning resources for that batch kind"""
    finish_mock = mocker.patch(
        "learning_resources_search.tasks.finish_reindex_job", autospec=True
    )
    job = TaskJobFactory.create(
        task_name=REINDEX_TASK_NAME, status=TaskJob.Status.RUNNING
    )
    batch = TaskBatchFactory.create(
        job=job,
        kind=ReindexBatchKind.learning_resources.value,
        params={"ids": [1, 2], "index_name": COURSE_TYPE},
    )

    run_reindex_batch.delay(batch.id)

    mocked_api.index_learning_resources.assert_called_once_with(
        [1, 2], COURSE_TYPE, IndexestoUpdate.reindexing_index.value
    )
    batch.refresh_from_db()
    assert batch.status == TaskBatch.Status.SUCCEEDED
    # the last batch of the job claims the finish step
    job.refresh_from_db()
    assert job.status == TaskJob.Status.FINISHING
    finish_mock.delay.assert_called_once_with(job.id)


def test_run_reindex_batch_content_files(mocker, mocked_api):
    """run_reindex_batch should index content files for that batch kind"""
    mocker.patch("learning_resources_search.tasks.finish_reindex_job", autospec=True)
    job = TaskJobFactory.create(
        task_name=REINDEX_TASK_NAME, status=TaskJob.Status.RUNNING
    )
    batch = TaskBatchFactory.create(
        job=job,
        kind=ReindexBatchKind.content_files.value,
        params={
            "ids": [3, 4],
            "learning_resource_id": 7,
            "resource_type": PROGRAM_TYPE,
        },
    )

    run_reindex_batch.delay(batch.id)

    mocked_api.index_content_files.assert_called_once_with(
        [3, 4],
        7,
        index_types=IndexestoUpdate.reindexing_index.value,
        resource_type=PROGRAM_TYPE,
    )
    batch.refresh_from_db()
    assert batch.status == TaskBatch.Status.SUCCEEDED


def test_run_reindex_batch_percolate(mocker, mocked_api):
    """run_reindex_batch should index percolate queries for that batch kind"""
    mocker.patch("learning_resources_search.tasks.finish_reindex_job", autospec=True)
    serialize_mock = mocker.patch(
        "learning_resources_search.tasks.serialize_bulk_percolators",
        return_value=["serialized"],
    )
    job = TaskJobFactory.create(
        task_name=REINDEX_TASK_NAME, status=TaskJob.Status.RUNNING
    )
    batch = TaskBatchFactory.create(
        job=job,
        kind=ReindexBatchKind.percolate.value,
        params={"ids": [5, 6]},
    )

    run_reindex_batch.delay(batch.id)

    serialize_mock.assert_called_once_with([5, 6])
    mocked_api.index_items.assert_called_once_with(
        ["serialized"],
        PERCOLATE_INDEX_TYPE,
        IndexestoUpdate.reindexing_index.value,
    )
    batch.refresh_from_db()
    assert batch.status == TaskBatch.Status.SUCCEEDED


def test_run_reindex_batch_dispatch_content_files(mocker, mocked_api):
    """
    A dispatch batch should create and enqueue content file batches, idempotently
    """
    settings.OPENSEARCH_DOCUMENT_INDEXING_CHUNK_SIZE = 2
    course = CourseFactory.create(etl_source=ETLSource.ocw.value)
    run = course.learning_resource.runs.first()
    run_files = sorted(
        ContentFileFactory.create_batch(3, run=run), key=lambda file: file.id
    )
    marketing_file = ContentFileFactory.create(
        learning_resource=course.learning_resource
    )
    delay_mock = mocker.patch.object(run_reindex_batch, "delay")

    job = TaskJobFactory.create(
        task_name=REINDEX_TASK_NAME, status=TaskJob.Status.RUNNING
    )
    batch = TaskBatchFactory.create(
        job=job,
        kind=ReindexBatchKind.dispatch_content_files.value,
        params={
            "learning_resource_ids": [course.learning_resource_id],
            "resource_type": COURSE_TYPE,
        },
    )

    run_reindex_batch(batch.id)

    children = job.batches.filter(kind=ReindexBatchKind.content_files.value).order_by(
        "batch_key"
    )
    assert children.count() == 3
    child_params = [child.params for child in children]
    assert {
        "ids": [run_files[0].id, run_files[1].id],
        "learning_resource_id": course.learning_resource_id,
        "resource_type": COURSE_TYPE,
    } in child_params
    assert {
        "ids": [run_files[2].id],
        "learning_resource_id": course.learning_resource_id,
        "resource_type": COURSE_TYPE,
    } in child_params
    assert {
        "ids": [marketing_file.id],
        "learning_resource_id": course.learning_resource_id,
        "resource_type": COURSE_TYPE,
    } in child_params

    batch.refresh_from_db()
    assert batch.status == TaskBatch.Status.SUCCEEDED
    assert delay_mock.call_count == 3

    # re-running the dispatch (e.g. on redelivery) must not duplicate children
    TaskBatch.objects.filter(id=batch.id).update(status=TaskBatch.Status.QUEUED)
    run_reindex_batch(batch.id)
    assert job.batches.filter(kind=ReindexBatchKind.content_files.value).count() == 3


def test_run_reindex_batch_error(mocker, mocked_api):
    """run_reindex_batch should mark the batch failed on a non-retryable error"""
    finish_mock = mocker.patch(
        "learning_resources_search.tasks.finish_reindex_job", autospec=True
    )
    mocked_api.index_learning_resources.side_effect = ValueError("boom")
    job = TaskJobFactory.create(
        task_name=REINDEX_TASK_NAME, status=TaskJob.Status.RUNNING
    )
    batch = TaskBatchFactory.create(
        job=job,
        kind=ReindexBatchKind.learning_resources.value,
        params={"ids": [1], "index_name": COURSE_TYPE},
    )

    run_reindex_batch.delay(batch.id)

    batch.refresh_from_db()
    assert batch.status == TaskBatch.Status.FAILED
    assert "boom" in batch.error
    # failed batches still count toward completion so the job can finish/clean up
    job.refresh_from_db()
    assert job.status == TaskJob.Status.FINISHING
    finish_mock.delay.assert_called_once_with(job.id)


def test_run_reindex_batch_retry(mocker, mocked_api):
    """run_reindex_batch should retry on search connection errors"""
    mocker.patch("learning_resources_search.tasks.finish_reindex_job", autospec=True)
    mocked_api.index_learning_resources.side_effect = ESConnectionError(
        "err", "err", "err"
    )
    job = TaskJobFactory.create(
        task_name=REINDEX_TASK_NAME, status=TaskJob.Status.RUNNING
    )
    batch = TaskBatchFactory.create(
        job=job,
        kind=ReindexBatchKind.learning_resources.value,
        params={"ids": [1], "index_name": COURSE_TYPE},
    )

    with pytest.raises(Retry):
        run_reindex_batch.delay(batch.id)

    batch.refresh_from_db()
    # the batch is left non-terminal so the celery retry re-runs it
    assert batch.status == TaskBatch.Status.RUNNING


def test_run_reindex_batch_on_failure_fails_batch(mocker):
    """
    When run_reindex_batch gives up (retries exhausted) its on_failure handler
    should mark the batch FAILED and nudge the job toward completion
    """
    finish_mock = mocker.patch(
        "learning_resources_search.tasks.finish_reindex_job", autospec=True
    )
    job = TaskJobFactory.create(
        task_name=REINDEX_TASK_NAME, status=TaskJob.Status.RUNNING
    )
    batch = TaskBatchFactory.create(
        job=job,
        kind=ReindexBatchKind.learning_resources.value,
        status=TaskBatch.Status.RUNNING,
    )

    run_reindex_batch.on_failure(RetryError("boom"), "task-id", [batch.id], {}, None)

    batch.refresh_from_db()
    assert batch.status == TaskBatch.Status.FAILED
    assert "boom" in batch.error
    # it was the only batch, so the job is now claimable for finishing
    job.refresh_from_db()
    assert job.status == TaskJob.Status.FINISHING
    finish_mock.delay.assert_called_once_with(job.id)


def test_finish_reindex_job_on_failure_fails_job():
    """
    When finish_reindex_job gives up its on_failure handler should mark the
    FINISHING job FAILED so it doesn't hang active forever
    """
    job = TaskJobFactory.create(
        task_name=REINDEX_TASK_NAME,
        params={"indexes": ["course"], "backing_indexes": {"course": "backing"}},
        status=TaskJob.Status.FINISHING,
    )

    finish_reindex_job.on_failure(
        RetryError("switch failed"), "task-id", [job.id], {}, None
    )

    job.refresh_from_db()
    assert job.status == TaskJob.Status.FAILED
    assert "switch failed" in job.error


@pytest.mark.parametrize(
    ("batch_status", "job_status"),
    [
        (TaskBatch.Status.SUCCEEDED, TaskJob.Status.RUNNING),
        (TaskBatch.Status.QUEUED, TaskJob.Status.FAILED),
    ],
)
def test_run_reindex_batch_noop(mocker, mocked_api, batch_status, job_status):
    """run_reindex_batch should do nothing if the batch or job is terminal"""
    mocker.patch("learning_resources_search.tasks.finish_reindex_job", autospec=True)
    job = TaskJobFactory.create(task_name=REINDEX_TASK_NAME, status=job_status)
    batch = TaskBatchFactory.create(
        job=job,
        kind=ReindexBatchKind.learning_resources.value,
        status=batch_status,
        params={"ids": [1], "index_name": COURSE_TYPE},
    )

    run_reindex_batch.delay(batch.id)

    mocked_api.index_learning_resources.assert_not_called()
    batch.refresh_from_db()
    assert batch.status == batch_status


def test_maybe_finish_reindex_job(mocker):
    """_maybe_finish_reindex_job should claim the finish exactly once"""
    finish_mock = mocker.patch(
        "learning_resources_search.tasks.finish_reindex_job", autospec=True
    )
    job = TaskJobFactory.create(
        task_name=REINDEX_TASK_NAME, status=TaskJob.Status.RUNNING
    )
    done_batch = TaskBatchFactory.create(job=job, status=TaskBatch.Status.SUCCEEDED)
    pending_batch = TaskBatchFactory.create(job=job, status=TaskBatch.Status.QUEUED)

    _maybe_finish_reindex_job(job.id)
    job.refresh_from_db()
    assert job.status == TaskJob.Status.RUNNING
    finish_mock.delay.assert_not_called()

    TaskBatch.objects.filter(id=pending_batch.id).update(status=TaskBatch.Status.FAILED)
    _maybe_finish_reindex_job(job.id)
    job.refresh_from_db()
    assert job.status == TaskJob.Status.FINISHING
    finish_mock.delay.assert_called_once_with(job.id)

    # a second caller cannot claim the finish again
    _maybe_finish_reindex_job(job.id)
    assert finish_mock.delay.call_count == 1
    assert done_batch.job_id == job.id


def test_maybe_finish_reindex_job_no_batches(mocker):
    """A job with no batches at all should finish immediately"""
    finish_mock = mocker.patch(
        "learning_resources_search.tasks.finish_reindex_job", autospec=True
    )
    job = TaskJobFactory.create(
        task_name=REINDEX_TASK_NAME, status=TaskJob.Status.RUNNING
    )

    _maybe_finish_reindex_job(job.id)

    job.refresh_from_db()
    assert job.status == TaskJob.Status.FINISHING
    finish_mock.delay.assert_called_once_with(job.id)


@pytest.mark.usefixtures("_wrap_retry_mock")
@pytest.mark.parametrize("with_error", [True, False])
@pytest.mark.parametrize(
    "index_types",
    [
        IndexestoUpdate.current_index.value,
        IndexestoUpdate.reindexing_index.value,
        IndexestoUpdate.all_indexes.value,
    ],
)
def test_index_learning_resources_mock(mocker, with_error, index_types):
    """index_learning_resources should call the api function of the same name"""
    index_learning_resources_mock = mocker.patch(
        "learning_resources_search.indexing_api.index_learning_resources"
    )
    if with_error:
        index_learning_resources_mock.side_effect = TabError
    result = index_learning_resources.delay([1, 2, 3], COURSE_TYPE, index_types).get()
    assert result == ("index_courses threw an error" if with_error else None)

    index_learning_resources_mock.assert_called_once_with(
        [1, 2, 3], COURSE_TYPE, index_types
    )


def test_deindex_document(mocker):
    """deindex_document should call the api function of the same name"""
    deindex_document_mock = mocker.patch(
        "learning_resources_search.indexing_api.deindex_document"
    )
    deindex_document.delay(1, "course").get()
    deindex_document_mock.assert_called_once_with(1, "course")


@pytest.mark.usefixtures("_wrap_retry_mock")
@pytest.mark.parametrize("with_error", [True, False])
def test_bulk_deindex_learning_resources(mocker, with_error):
    """deindex_learning_resources task should call corresponding indexing api function"""
    indexing_api_deindex_mock = mocker.patch(
        "learning_resources_search.indexing_api.deindex_learning_resources"
    )

    if with_error:
        indexing_api_deindex_mock.side_effect = TabError
    result = bulk_deindex_learning_resources.delay([1], COURSE_TYPE).get()
    assert result == (
        "bulk_deindex_learning_resources threw an error" if with_error else None
    )

    indexing_api_deindex_mock.assert_called_once_with([1], COURSE_TYPE)


@pytest.mark.parametrize(
    ("indexes", "etl_source"),
    [
        (["program"], None),
        (["course, content_file"], None),
        (list(LEARNING_RESOURCE_TYPES), None),
        (["course"], ETLSource.xpro.value),
        (["content_file"], ETLSource.xpro.value),
        (["content_file"], ETLSource.oll.value),
    ],
)
def test_start_update_index(mocker, mocked_celery, indexes, etl_source, settings):  # noqa: PLR0915
    """
    recreate_index should recreate the OpenSearch index and reindex all data with it
    """

    settings.OPENSEARCH_INDEXING_CHUNK_SIZE = 2
    settings.OPENSEARCH_DOCUMENT_INDEXING_CHUNK_SIZE = 2

    mock_blocklist = mocker.patch(
        "learning_resources_search.tasks.load_course_blocklist", return_value=[]
    )

    etl_sources = [
        ETLSource.ocw,
        ETLSource.mit_edx,
        ETLSource.xpro,
        ETLSource.mitxonline,
    ]

    if COURSE_TYPE in indexes or CONTENT_FILE_TYPE in indexes:
        courses = sorted(
            [CourseFactory.create(etl_source=etl.value) for etl in etl_sources],
            key=lambda course: course.learning_resource_id,
        )

        for course in courses:
            ContentFileFactory.create_batch(
                3, run=course.learning_resource.runs.first()
            )

        # A resource-level (marketing page) content file attached directly to
        # the learning resource rather than a run.
        xpro_course = next(
            course
            for course in courses
            if course.learning_resource.etl_source == ETLSource.xpro.value
        )
        xpro_marketing_file = ContentFileFactory.create(
            learning_resource=xpro_course.learning_resource
        )

        unpublished_courses = sorted(
            [
                CourseFactory.create(
                    etl_source=etl.value,
                    is_unpublished=True,
                )
                for etl in etl_sources
            ],
            key=lambda course: course.learning_resource_id,
        )
    else:
        programs = sorted(
            ProgramFactory.create_batch(4),
            key=lambda program: program.learning_resource_id,
        )
        unpublished_program = ProgramFactory.create(is_unpublished=True)

        # Program content files are only indexed for programs whose ETL source
        # has content files. Give one program such a source and attach both a
        # run-level and a resource-level (marketing page) content file.
        program_with_files = programs[0]
        program_with_files.learning_resource.etl_source = ETLSource.mitxonline.value
        program_with_files.learning_resource.save()
        program_run_file = ContentFileFactory.create(
            run=program_with_files.learning_resource.runs.first()
        )
        program_marketing_file = ContentFileFactory.create(
            learning_resource=program_with_files.learning_resource
        )

    index_learning_resources_mock = mocker.patch(
        "learning_resources_search.tasks.index_learning_resources", autospec=True
    )
    deindex_learning_resources_mock = mocker.patch(
        "learning_resources_search.tasks.bulk_deindex_learning_resources", autospec=True
    )

    index_content_mock = mocker.patch(
        "learning_resources_search.tasks.index_content_files", autospec=True
    )

    with pytest.raises(mocked_celery.replace_exception_class):
        start_update_index.delay(indexes, etl_source)

    assert mocked_celery.group.call_count == 1

    # Celery's 'group' function takes a generator as an argument. In order to make assertions about the items
    # in that generator, 'list' is being called to force iteration through all of those items.
    list(mocked_celery.group.call_args[0][0])

    if COURSE_TYPE in indexes:
        mock_blocklist.assert_called_once()

        if etl_source:
            assert index_learning_resources_mock.si.call_count == 1
            course = next(
                course
                for course in courses
                if course.learning_resource.etl_source == etl_source
            )
            index_learning_resources_mock.si.assert_any_call(
                [course.learning_resource_id],
                COURSE_TYPE,
                index_types=IndexestoUpdate.current_index.value,
            )

            assert deindex_learning_resources_mock.si.call_count == 1
            unpublished_course = next(
                course
                for course in unpublished_courses
                if course.learning_resource.etl_source == etl_source
            )
            deindex_learning_resources_mock.si.assert_any_call(
                [unpublished_course.learning_resource_id], COURSE_TYPE
            )
        else:
            assert index_learning_resources_mock.si.call_count == 2
            index_learning_resources_mock.si.assert_any_call(
                [courses[0].learning_resource_id, courses[1].learning_resource_id],
                COURSE_TYPE,
                index_types=IndexestoUpdate.current_index.value,
            )
            index_learning_resources_mock.si.assert_any_call(
                [courses[2].learning_resource_id, courses[3].learning_resource_id],
                COURSE_TYPE,
                index_types=IndexestoUpdate.current_index.value,
            )

            assert deindex_learning_resources_mock.si.call_count == 2
            deindex_learning_resources_mock.si.assert_any_call(
                [
                    unpublished_courses[0].learning_resource_id,
                    unpublished_courses[1].learning_resource_id,
                ],
                COURSE_TYPE,
            )
            deindex_learning_resources_mock.si.assert_any_call(
                [
                    unpublished_courses[2].learning_resource_id,
                    unpublished_courses[3].learning_resource_id,
                ],
                COURSE_TYPE,
            )

    if indexes == [PROGRAM_TYPE]:
        assert index_learning_resources_mock.si.call_count == 2
        index_learning_resources_mock.si.assert_any_call(
            [programs[0].learning_resource_id, programs[1].learning_resource_id],
            PROGRAM_TYPE,
            index_types=IndexestoUpdate.current_index.value,
        )
        index_learning_resources_mock.si.assert_any_call(
            [programs[2].learning_resource_id, programs[3].learning_resource_id],
            PROGRAM_TYPE,
            index_types=IndexestoUpdate.current_index.value,
        )

        assert deindex_learning_resources_mock.si.call_count == 1
        deindex_learning_resources_mock.si.assert_any_call(
            [unpublished_program.learning_resource_id], PROGRAM_TYPE
        )

        # Program content files are indexed with resource_type=PROGRAM_TYPE, for
        # both run-level and resource-level (marketing page) content files.
        index_content_mock.si.assert_any_call(
            [program_run_file.id],
            program_with_files.learning_resource_id,
            index_types=IndexestoUpdate.current_index.value,
            resource_type=PROGRAM_TYPE,
        )
        index_content_mock.si.assert_any_call(
            [program_marketing_file.id],
            program_with_files.learning_resource_id,
            index_types=IndexestoUpdate.current_index.value,
            resource_type=PROGRAM_TYPE,
        )

    if CONTENT_FILE_TYPE in indexes:
        if etl_source in RESOURCE_FILE_ETL_SOURCES:
            # 2 run-level chunks + 1 resource-level (marketing page) chunk
            assert index_content_mock.si.call_count == 3
            course = next(
                course
                for course in courses
                if course.learning_resource.etl_source == etl_source
            )

            content_file_ids = (
                course.learning_resource.runs.first()
                .content_files.order_by("id")
                .values_list("id", flat=True)
            )

            index_content_mock.si.assert_any_call(
                [content_file_ids[0], content_file_ids[1]],
                course.learning_resource_id,
                index_types=IndexestoUpdate.current_index.value,
            )

            index_content_mock.si.assert_any_call(
                [content_file_ids[2]],
                course.learning_resource_id,
                index_types=IndexestoUpdate.current_index.value,
            )

            # resource-level (marketing page) content file attached directly to
            # the learning resource
            index_content_mock.si.assert_any_call(
                [xpro_marketing_file.id],
                course.learning_resource_id,
                index_types=IndexestoUpdate.current_index.value,
            )

        elif etl_source:
            assert index_content_mock.si.call_count == 0
        else:
            assert index_content_mock.si.call_count == 4

    assert mocked_celery.replace.call_count == 1
    assert mocked_celery.replace.call_args[0][1] == mocked_celery.chain.return_value


def test_upsert_content_file_task(mocked_api):
    """upsert_content_file routes to the correct index based on the parent resource type"""
    course = CourseFactory.create(etl_source=ETLSource.ocw.value)
    content_file = ContentFileFactory.create(run=course.learning_resource.runs.first())
    upsert_content_file(content_file.id)
    data = serialize_content_file_for_update(content_file)
    mocked_api.upsert_document.assert_called_once_with(
        gen_content_file_id(content_file.id),
        data,
        COURSE_TYPE,
        retry_on_conflict=settings.INDEXING_ERROR_RETRIES,
        routing=course.learning_resource_id,
    )


def test_upsert_content_file_task_program(mocked_api):
    """upsert_content_file routes program content files to the program index"""
    program = ProgramFactory.create()
    content_file = ContentFileFactory.create(run=program.learning_resource.runs.first())
    upsert_content_file(content_file.id)
    data = serialize_content_file_for_update(content_file)
    mocked_api.upsert_document.assert_called_once_with(
        gen_content_file_id(content_file.id),
        data,
        PROGRAM_TYPE,
        retry_on_conflict=settings.INDEXING_ERROR_RETRIES,
        routing=program.learning_resource_id,
    )


def test_upsert_content_file_task_relationship_through_learning_resource_id(mocked_api):
    """upsert_content_file handles content files attached via learning_resource_id (not run_id)"""
    program = ProgramFactory.create()
    content_file = ContentFileFactory.create(
        learning_resource=program.learning_resource
    )
    upsert_content_file(content_file.id)
    data = serialize_content_file_for_update(content_file)
    mocked_api.upsert_document.assert_called_once_with(
        gen_content_file_id(content_file.id),
        data,
        PROGRAM_TYPE,
        retry_on_conflict=settings.INDEXING_ERROR_RETRIES,
        routing=program.learning_resource_id,
    )


@pytest.mark.usefixtures("_wrap_retry_mock")
@pytest.mark.parametrize("with_error", [True, False])
@pytest.mark.parametrize(
    "index_types",
    [IndexestoUpdate.all_indexes.value, IndexestoUpdate.current_index.value],
)
def test_index_run_content_files(mocker, with_error, index_types):
    """index_run_content_files should call the api function of the same name"""
    index_run_content_files_mock = mocker.patch(
        "learning_resources_search.indexing_api.index_run_content_files"
    )
    deindex_run_content_files_mock = mocker.patch(
        "learning_resources_search.indexing_api.deindex_run_content_files"
    )
    if with_error:
        index_run_content_files_mock.side_effect = TabError
    result = index_run_content_files.delay(1, index_types=index_types).get()
    assert result == ("index_run_content_files threw an error" if with_error else None)

    index_run_content_files_mock.assert_called_once_with(1, index_types=index_types)

    if not with_error:
        deindex_run_content_files_mock.assert_called_once_with(1, unpublished_only=True)


@pytest.mark.usefixtures("_wrap_retry_mock")
@pytest.mark.parametrize("with_error", [True, False])
@pytest.mark.parametrize("unpublished_only", [True, False])
def test_delete_run_content_files(mocker, with_error, unpublished_only):
    """deindex_run_content_files should call the api function of the same name"""
    deindex_run_content_files_mock = mocker.patch(
        "learning_resources_search.indexing_api.deindex_run_content_files"
    )
    if with_error:
        deindex_run_content_files_mock.side_effect = TabError
    result = deindex_run_content_files.delay(1, unpublished_only=unpublished_only).get()
    deindex_run_content_files_mock.assert_called_once_with(
        1, unpublished_only=unpublished_only, keep_published=False
    )

    assert result == (
        "deindex_run_content_files threw an error" if with_error else None
    )


@pytest.mark.django_db
def test_send_subscription_emails(mocked_api, mocker, mocked_celery):
    """
    Test that a subscribed user receives
    emails with percolate matches
    """
    settings.USE_TZ = False
    topics = [
        "Mechanical Engineering",
        "Environmental Engineering",
        "Systems Engineering",
    ]

    LearningResource.objects.all().delete()
    LearningResourceFactory.create_batch(len(topics), is_course=True)
    user = UserFactory.create()
    queries = []
    query_ids = []
    user_documents = {key: [] for key in topics}
    for topic in topics:
        query = PercolateQueryFactory.create()
        query.original_query["topic"] = [topic]
        query.source_type = PercolateQuery.CHANNEL_SUBSCRIPTION_TYPE
        query.users.set([user])
        query.save()

        queries.append(query)
        query_ids.append(query.id)

    percolate_matches_for_document_mock = mocker.patch(
        "learning_resources_search.tasks.percolate_matches_for_document",
    )

    def get_percolator(res):
        query_id = query_ids.pop()
        pq = PercolateQuery.objects.filter(id=query_id).first()
        og_query = OrderedDict(pq.original_query)
        ptopic = og_query["topic"][0]
        user_documents[ptopic].append(LearningResource.objects.get(id=res))
        return PercolateQuery.objects.filter(id=query_id)

    percolate_matches_for_document_mock.side_effect = get_percolator
    with pytest.raises(mocked_celery.replace_exception_class):
        send_subscription_emails(PercolateQuery.CHANNEL_SUBSCRIPTION_TYPE)

    task_args = mocked_celery.group.call_args[0][0][0]["args"][0][0]
    template_data = task_args[1]
    assert user.id == task_args[0]
    for topic in topics:
        assert topic in template_data


@pytest.mark.django_db
def test_send_multiple_subscription_emails(mocked_api, mocker, mocked_celery):
    """
    Test that subscription email with
    multiple users and percolate matches
    """
    settings.USE_TZ = False
    topics = [
        "Mechanical Engineering",
        "Environmental Engineering",
        "Systems Engineering",
    ]

    LearningResource.objects.all().delete()
    LearningResourceFactory.create_batch(len(topics), is_course=True)

    queries = []
    query_ids = []
    user_documents = {key: [] for key in topics}
    for topic in topics:
        user = UserFactory.create()
        query = PercolateQueryFactory.create()
        query.original_query["topic"] = [topic]
        query.source_type = PercolateQuery.CHANNEL_SUBSCRIPTION_TYPE
        query.users.set([user])
        query.save()
        queries.append(query)
        query_ids.append(query.id)

    percolate_matches_for_document_mock = mocker.patch(
        "learning_resources_search.tasks.percolate_matches_for_document",
    )

    def get_percolator(res):
        query_id = query_ids.pop()
        pq = PercolateQuery.objects.filter(id=query_id).first()
        og_query = OrderedDict(pq.original_query)
        ptopic = og_query["topic"][0]
        user_documents[ptopic].append(LearningResource.objects.get(id=res))
        return PercolateQuery.objects.filter(id=query_id)

    percolate_matches_for_document_mock.side_effect = get_percolator
    with pytest.raises(mocked_celery.replace_exception_class):
        send_subscription_emails.apply((PercolateQuery.CHANNEL_SUBSCRIPTION_TYPE,))

    task_args = mocked_celery.group.call_args[0][0][0]["args"]

    user_ids = [arg[0] for arg in task_args[0]]
    for user in User.objects.all():
        assert user.id in user_ids
    assert len(task_args[0]) == 3

    template_data = task_args[0][0][1]

    assert len([topic for topic in topics if topic in template_data]) > 0


def test_infer_percolate_group(mocked_api):
    """
    Test that the the email template groups can be inferred from queries
    """
    topic = "Mechanical Engineering"
    topic_query = PercolateQueryFactory.create()
    topic_query.original_query["topic"] = [topic]
    topic_query.save()
    assert _infer_percolate_group(topic_query) == topic
    department = LearningResourceDepartmentFactory.create()
    department_query = PercolateQueryFactory.create()
    department_query.original_query["topic"] = []
    department_query.original_query["department"] = [department.department_id]
    department_query.save()
    assert _infer_percolate_group(department_query) == department.name
    offerer = LearningResourceOfferorFactory.create()
    offerer_query = PercolateQueryFactory.create()
    offerer_query.original_query["topic"] = []
    offerer_query.original_query["offered_by"] = [offerer.code]
    offerer_query.save()
    assert _infer_percolate_group(offerer_query) == offerer.name


def test_percolate_user_grouping(mocked_api, mocker):
    """
    Test that each user receives an email with resources
    they are supposed to recieve (based off of subscription)
    """
    topic_name = "Mechanical Engineering"
    topic = LearningResourceTopicFactory.create(name=topic_name)
    alternate_topic = LearningResourceTopicFactory.create(
        name=f"{topic_name}_alternate"
    )
    offerer = LearningResourceOfferorFactory.create()
    department = LearningResourceDepartmentFactory.create()
    alternate_department = LearningResourceDepartmentFactory.create()

    resource_a = LearningResourceFactory.create(
        title="resource A",
        topics=[topic, alternate_topic],
        is_course=True,
        offered_by=offerer,
        departments=[department],
    )

    resource_b = LearningResourceFactory.create(
        title="resource B",
        topics=[alternate_topic],
        is_course=True,
    )
    resource_c = LearningResourceFactory.create(
        title="resource C",
        departments=[alternate_department],
        is_course=True,
        topics=[],
    )

    user_a, user_b, user_c, user_d = UserFactory.create_batch(4)

    topic_query = PercolateQueryFactory.create()
    topic_query.original_query["topic"] = [topic_name]

    alternate_topic_query = PercolateQueryFactory.create()
    alternate_topic_query.original_query["topic"] = [f"{topic_name}_alternate"]

    department_query = PercolateQueryFactory.create()
    department_query.original_query["department"] = [department.department_id]

    alternate_department_query = PercolateQueryFactory.create()
    alternate_department_query.original_query["department"] = [
        alternate_department.department_id
    ]

    offerer_query = PercolateQueryFactory.create()
    offerer_query.source_type = PercolateQuery.CHANNEL_SUBSCRIPTION_TYPE
    offerer_query.original_query["offered_by"] = [offerer.code]

    # user_a should have 1 percolated doc
    topic_query.users.add(user_a)

    # user_b should have 3 percolated docs
    topic_query.users.add(user_b)
    alternate_topic_query.users.add(user_b)
    alternate_department_query.users.add(user_b)

    # user_c should have 2 percolated doc
    department_query.users.add(user_c)
    alternate_department_query.users.add(user_c)

    # user_d should have 1 percolated doc
    offerer_query.users.add(user_d)

    # save all the queries
    for query in [
        department_query,
        alternate_topic_query,
        offerer_query,
        topic_query,
        alternate_department_query,
    ]:
        query.source_type = PercolateQuery.CHANNEL_SUBSCRIPTION_TYPE
        query.save()

    percolate_matches_for_document_mock = mocker.patch(
        "learning_resources_search.tasks.percolate_matches_for_document",
    )

    def _matches_for_document(resource_id):
        """
        Mock percolation
        """
        if resource_id == resource_a.id:
            return PercolateQuery.objects.filter(
                id__in=[
                    topic_query.id,
                    alternate_topic_query.id,
                    department_query.id,
                    offerer_query.id,
                ]
            )
        elif resource_id == resource_b.id:
            return PercolateQuery.objects.filter(
                id__in=[
                    alternate_topic_query.id,
                ]
            )
        elif resource_id == resource_c.id:
            return PercolateQuery.objects.filter(
                id__in=[
                    alternate_department_query.id,
                ]
            )
        else:
            return PercolateQuery.objects.none()

    percolate_matches_for_document_mock.side_effect = _matches_for_document

    rows = _get_percolated_rows(
        [resource_a, resource_b, resource_c], "channel_subscription_type"
    )
    grouped_by_user = _group_percolated_rows(rows)
    resources_by_user = {}
    # get the total number of resources for each user
    for user in [user_a, user_b, user_c, user_d]:
        resources_by_user[user.id] = sum(
            [len(items) for items in grouped_by_user[user.id].values()]
        )

    assert resources_by_user[user_a.id] == 1
    assert resources_by_user[user_b.id] == 3
    assert resources_by_user[user_c.id] == 2
    assert resources_by_user[user_d.id] == 1


def test_email_grouping_function(mocked_api, mocker):
    """
    Test that template data for digest emails are grouped correctly
    """
    settings.USE_TZ = False
    topics = [
        "Mechanical Engineering",
        "Environmental Engineering",
        "Systems Engineering",
    ]

    LearningResource.objects.all().delete()
    new_resources = LearningResourceFactory.create_batch(len(topics), is_course=True)

    queries = []
    query_ids = []
    user_ids = []
    user_documents = {key: [] for key in topics}
    for topic in topics:
        user = UserFactory.create()
        query = PercolateQueryFactory.create()
        query.original_query["topic"] = [topic]
        query.source_type = PercolateQuery.CHANNEL_SUBSCRIPTION_TYPE
        query.users.set([user])
        user_ids.append(user.id)
        query.save()
        queries.append(query)
        query_ids.append(query.id)

    percolate_matches_for_document_mock = mocker.patch(
        "learning_resources_search.tasks.percolate_matches_for_document",
    )

    def get_percolator(res):
        query_id = query_ids.pop()
        pq = PercolateQuery.objects.filter(id=query_id).first()
        og_query = OrderedDict(pq.original_query)
        ptopic = og_query["topic"][0]
        user_documents[ptopic].append(LearningResource.objects.get(id=res))
        return PercolateQuery.objects.filter(id=query_id)

    percolate_matches_for_document_mock.side_effect = get_percolator
    rows = _get_percolated_rows(new_resources, PercolateQuery.CHANNEL_SUBSCRIPTION_TYPE)
    template_data = _group_percolated_rows(rows)
    assert len(template_data) == len(topics)
    assert len(template_data[user_ids[0]]) == 1


def test_digest_email_template(mocked_api, mocker, mocked_celery):
    """
    Test that email digest for percolated matches contains the
    correct total and that the topic groups appear in the email
    """
    settings.USE_TZ = False
    topics = [
        "Mechanical Engineering",
        "Environmental Engineering",
        "Systems Engineering",
    ]

    LearningResource.objects.all().delete()
    LearningResourceFactory.create_batch(len(topics), is_course=True)

    queries = []
    query_ids = []

    user = UserFactory.create()

    percolate_matches_for_document_mock = mocker.patch(
        "learning_resources_search.tasks.percolate_matches_for_document",
    )

    def get_percolator(res):
        query = PercolateQueryFactory.create()
        query.original_query["topic"] = [topics.pop()]
        query.source_type = PercolateQuery.CHANNEL_SUBSCRIPTION_TYPE
        query.users.set([user])
        query.save()
        queries.append(query)
        query_ids.append(query.id)
        return PercolateQuery.objects.filter(id=query.id)

    percolate_matches_for_document_mock.side_effect = get_percolator
    with pytest.raises(mocked_celery.replace_exception_class):
        send_subscription_emails.apply([PercolateQuery.CHANNEL_SUBSCRIPTION_TYPE])
    task_args = mocked_celery.group.call_args[0][0][0]["args"][0][0]

    template_data = task_args[1]
    assert user.id == task_args[0]
    for topic in topics:
        assert topic in template_data


@pytest.mark.parametrize("reachable", [True, False])
def test_validated_resource_image_url(mock_image_url_is_reachable, reachable):
    """
    The digest email should use the resource image only if its URL is
    reachable, and the default image otherwise
    """
    mock_image_url_is_reachable.return_value = reachable
    resource = LearningResourceFactory.create(is_course=True)
    validated_url = _validated_resource_image_url(resource)
    if reachable:
        assert validated_url == resource.image.url
    else:
        assert validated_url == frontend_absolute_url("/images/default_resource.jpg")
    mock_image_url_is_reachable.assert_called_once_with(resource.image.url)


def test_validated_resource_image_url_no_image(mock_image_url_is_reachable):
    """The digest email should use the default image if the resource has none"""
    resource = LearningResourceFactory.create(is_course=True, no_image=True)
    assert _validated_resource_image_url(resource) == frontend_absolute_url(
        "/images/default_resource.jpg"
    )
    mock_image_url_is_reachable.assert_not_called()


def test_subscription_digest_subject():
    """
    Test that email generates a dynamic subject based
    on the unique resource types included
    """
    resource_types = {"program"}
    sample_course = {"source_channel_type": "topic", "resource_title": "robotics"}

    subject_line = _generate_subscription_digest_subject(
        sample_course,
        "electronics",
        resource_types,
        total_count=1,
        shortform=False,
    )
    assert subject_line == "MIT Learn: New program in electronics: robotics"

    sample_course = {"source_channel_type": "podcast", "resource_title": "robotics"}
    resource_types = {"program"}

    subject_line = _generate_subscription_digest_subject(
        sample_course,
        "xpro",
        resource_types,
        total_count=9,
        shortform=False,
    )
    assert subject_line == "MIT Learn: New programs from xpro: robotics"

    resource_types = {"podcast"}
    subject_line = _generate_subscription_digest_subject(
        sample_course,
        "engineering",
        resource_types,
        total_count=19,
        shortform=False,
    )
    assert subject_line == "MIT Learn: New podcasts from engineering: robotics"

    resource_types = {"course"}
    subject_line = _generate_subscription_digest_subject(
        sample_course, "management", resource_types, 19, shortform=True
    )
    assert subject_line == "New courses from management"


def test_subscription_digest_subject_multiple_types():
    """
    Test that when there are multiple unique resource types
    we use Leaning Resource in the header
    """
    resource_types = {"program"}
    sample_course = {"source_channel_type": "topic", "resource_title": "robotics"}

    subject_line = _generate_subscription_digest_subject(
        sample_course,
        "electronics",
        resource_types,
        total_count=1,
        shortform=False,
    )
    assert subject_line == "MIT Learn: New program in electronics: robotics"

    sample_course = {"source_channel_type": "podcast", "resource_title": "robotics"}
    resource_types = {"program", "video", "podcast"}

    subject_line = _generate_subscription_digest_subject(
        sample_course,
        "xpro",
        resource_types,
        total_count=9,
        shortform=False,
    )
    assert subject_line == "MIT Learn: New Learning Resources from xpro: robotics"


def test_update_featured_rank(mocker, offeror_featured_lists):
    """The updated_featured_rank task should make the expected calls"""

    mocker.patch(
        "learning_resources_search.tasks.random",
        return_value=0.4,
    )

    clear_featured_rank = mocker.patch(
        "learning_resources_search.tasks.api.clear_featured_rank"
    )

    update_with_partial = mocker.patch(
        "learning_resources_search.tasks.api.update_document_with_partial"
    )

    featured_view_set = FeaturedViewSet()
    featured_resources = featured_view_set.get_queryset()

    update_featured_rank()

    for rank in range(3):
        clear_featured_rank.assert_any_call(rank, clear_all_greater_than=False)
    clear_featured_rank.assert_any_call(3, clear_all_greater_than=True)

    for resource in featured_resources:
        update_with_partial.assert_any_call(
            resource.id,
            {"featured_rank": resource.position + 0.4},
            resource.resource_type,
        )


def test_cache_clears_after_update_featured_rank(mocker, offeror_featured_lists):
    """The updated_featured_rank task should make the expected calls"""

    mocker.patch(
        "learning_resources_search.tasks.random",
        return_value=0.4,
    )

    mocker.patch("learning_resources_search.tasks.api.clear_featured_rank")
    mocked_clear_views_cache = mocker.patch(
        "learning_resources_search.tasks.clear_views_cache"
    )
    mocker.patch("learning_resources_search.tasks.api.update_document_with_partial")

    update_featured_rank()
    assert mocked_clear_views_cache.call_count == 1


def test_cache_is_cleared_after_reindex(mocker):
    """Test that the search cache is cleared out after every reindex"""

    mocked_clear_views_cache = mocker.patch(
        "learning_resources_search.tasks.clear_views_cache"
    )

    job = TaskJobFactory.create(
        task_name=REINDEX_TASK_NAME,
        params={
            "indexes": ["course", "program"],
            "backing_indexes": {"course": "backing", "program": "backing"},
        },
        status=TaskJob.Status.FINISHING,
    )
    mocker.patch("learning_resources_search.indexing_api.switch_indices", autospec=True)
    mocker.patch("learning_resources_search.indexing_api.delete_orphaned_indexes")
    mocker.patch(
        "learning_resources_search.indexing_api.is_default_backing_index",
        autospec=True,
        return_value=False,
    )
    finish_reindex_job.delay(job.id)
    assert mocked_clear_views_cache.call_count == 1


def test_cache_is_cleared_after_update_index(mocker, settings):
    """Test that the search cache is cleared out after an update of the index"""
    settings.OPENSEARCH_INDEXING_CHUNK_SIZE = 2
    settings.OPENSEARCH_DOCUMENT_INDEXING_CHUNK_SIZE = 2
    mocker.patch(
        "learning_resources_search.tasks.index_learning_resources", autospec=True
    )
    mocker.patch(
        "learning_resources_search.tasks.get_update_courses_tasks", autospec=True
    )
    mocked_clear_views_cache = mocker.patch(
        "learning_resources_search.tasks.clear_views_cache"
    )
    mocker.patch(
        "learning_resources_search.tasks.load_course_blocklist", return_value=[]
    )
    sorted(
        CourseFactory.create_batch(4, etl_source=ETLSource.ocw.value),
        key=lambda course: course.learning_resource_id,
    )

    with pytest.raises(Ignore):
        start_update_index.run(["course"], None)
    assert mocked_clear_views_cache.call_count == 1
