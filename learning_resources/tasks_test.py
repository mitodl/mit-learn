"""
Test tasks
"""

from datetime import timedelta
from unittest.mock import ANY

import pytest
from decorator import contextmanager
from django.utils import timezone
from moto import mock_aws

from learning_resources import factories, models, tasks
from learning_resources.conftest import OCW_TEST_PREFIX, setup_s3, setup_s3_ocw
from learning_resources.constants import LearningResourceType, PlatformType
from learning_resources.etl.constants import MARKETING_PAGE_FILE_TYPE, ETLSource
from learning_resources.factories import (
    LearningResourceFactory,
    LearningResourcePlatformFactory,
)
from learning_resources.models import LearningResource
from learning_resources.tasks import (
    get_ocw_data,
    get_youtube_data,
    get_youtube_transcripts,
    marketing_page_for_resources,
    remove_duplicate_resources,
    scrape_marketing_pages,
    sync_canvas_courses,
    update_next_start_date_and_prices,
)
from main.utils import now_in_utc

pytestmark = pytest.mark.django_db
# pylint:disable=redefined-outer-name,unused-argument,too-many-arguments


@contextmanager
def does_not_raise():
    """
    Mock expression that does not raise an error
    """
    yield


@pytest.fixture
def mock_logger(mocker):
    """
    Mock log exception
    """
    return mocker.patch("learning_resources.api.log.exception")


@pytest.fixture
def mock_blocklist(mocker):
    """Mock the load_course_blocklist function"""
    return mocker.patch(
        "learning_resources.tasks.load_course_blocklist", return_value=[]
    )


def test_cache_is_cleared_after_task_run(mocker, mocked_celery):
    """Test that the search cache is cleared out after every task run"""
    mocker.patch("learning_resources.tasks.ocw_courses_etl", autospec=True)
    mocker.patch("learning_resources.tasks.get_content_tasks", autospec=True)
    mocker.patch("learning_resources.tasks.pipelines")
    mocked_clear_views_cache = mocker.patch(
        "learning_resources.tasks.clear_views_cache"
    )
    tasks.get_mit_edx_data.delay()
    tasks.update_next_start_date_and_prices.delay()
    tasks.get_micromasters_data.delay()
    tasks.get_mit_edx_data.delay()
    tasks.get_mitxonline_data.delay()
    tasks.get_oll_data.delay()
    tasks.get_xpro_data.delay()
    tasks.get_podcast_data.delay()

    tasks.get_ocw_courses.delay(
        url_paths=[OCW_TEST_PREFIX],
        force_overwrite=False,
        skip_content_files=True,
    )

    tasks.get_youtube_data.delay()
    tasks.get_youtube_transcripts.delay()
    assert mocked_clear_views_cache.call_count == 11


def test_get_micromasters_data(mocker):
    """Verify that the get_micromasters_data invokes the MicroMasters ETL pipeline"""
    mock_pipelines = mocker.patch("learning_resources.tasks.pipelines")

    tasks.get_micromasters_data.delay()
    mock_pipelines.micromasters_etl.assert_called_once_with()


def test_get_mit_edx_data_valid(mocker):
    """Verify that the get_mit_edx_data invokes the MIT edX ETL pipelines"""
    mock_pipelines = mocker.patch("learning_resources.tasks.pipelines")

    tasks.get_mit_edx_data.delay()
    mock_pipelines.mit_edx_courses_etl.assert_called_once_with(None)
    mock_pipelines.mit_edx_programs_etl.assert_called_once_with(None)


def test_get_mitxonline_data(mocker):
    """Verify that the get_mitxonline_data invokes the MITx Online ETL pipeline"""
    mock_pipelines = mocker.patch("learning_resources.tasks.pipelines")
    tasks.get_mitxonline_data.delay()
    mock_pipelines.mitxonline_programs_etl.assert_called_once_with()
    mock_pipelines.mitxonline_courses_etl.assert_called_once_with()


def test_get_oll_data(mocker):
    """Verify that the get_oll_data invokes the OLL ETL pipeline"""
    mock_pipelines = mocker.patch("learning_resources.tasks.pipelines")
    tasks.get_oll_data.delay()
    mock_pipelines.oll_etl.assert_called_once_with(None)


def test_get_mitpe_data(mocker):
    """Verify that the get_mitpe_data task invokes the Professional Ed pipeline"""
    mock_pipelines = mocker.patch("learning_resources.tasks.pipelines")
    mock_pipelines.mitpe_etl.return_value = (
        LearningResourceFactory.create_batch(2),
        LearningResourceFactory.create_batch(1),
    )
    task = tasks.get_mitpe_data.delay()
    mock_pipelines.mitpe_etl.assert_called_once_with()
    assert task.result == 3


def test_get_xpro_data(mocker):
    """Verify that the get_xpro_data invokes the xPro ETL pipeline"""
    mock_pipelines = mocker.patch("learning_resources.tasks.pipelines")
    tasks.get_xpro_data.delay()
    mock_pipelines.xpro_programs_etl.assert_called_once_with()
    mock_pipelines.xpro_courses_etl.assert_called_once_with()


@mock_aws
def test_import_all_mit_edx_files(settings, mocker, mocked_celery, mock_blocklist):
    """import_all_mit_edx_files should start chunked tasks with correct bucket, platform"""
    setup_s3(settings)
    get_content_tasks_mock = mocker.patch(
        "learning_resources.tasks.get_content_tasks", autospec=True
    )
    with pytest.raises(mocked_celery.replace_exception_class):
        tasks.import_all_mit_edx_files.delay(
            chunk_size=4, overwrite=False, learning_resource_ids=[1]
        )
    get_content_tasks_mock.assert_called_once_with(
        ETLSource.mit_edx.name,
        chunk_size=4,
        overwrite=False,
        learning_resource_ids=[1],
    )


@mock_aws
def test_import_all_mitxonline_files(settings, mocker, mocked_celery, mock_blocklist):
    """import_all_mitxonline_files should be replaced with get_content_tasks"""
    setup_s3(settings)
    get_content_tasks_mock = mocker.patch(
        "learning_resources.tasks.get_content_tasks", autospec=True
    )

    with pytest.raises(mocked_celery.replace_exception_class):
        tasks.import_all_mitxonline_files.delay(
            chunk_size=3, overwrite=True, learning_resource_ids=None
        )
    get_content_tasks_mock.assert_called_once_with(
        PlatformType.mitxonline.name,
        chunk_size=3,
        overwrite=True,
        learning_resource_ids=None,
    )


@mock_aws
def test_import_all_xpro_files(settings, mocker, mocked_celery, mock_blocklist):
    """import_all_xpro_files should start chunked tasks with correct bucket, platform"""
    setup_s3(settings)
    get_content_tasks_mock = mocker.patch(
        "learning_resources.tasks.get_content_tasks", autospec=True
    )
    with pytest.raises(mocked_celery.replace_exception_class):
        tasks.import_all_xpro_files.delay(chunk_size=3, learning_resource_ids=[1])
    get_content_tasks_mock.assert_called_once_with(
        PlatformType.xpro.name, chunk_size=3, overwrite=False, learning_resource_ids=[1]
    )


@mock_aws
def test_import_all_oll_files(settings, mocker, mocked_celery, mock_blocklist):
    """import_all_oll_files should start chunked tasks with correct bucket, platform"""
    setup_s3(settings)
    get_content_tasks_mock = mocker.patch(
        "learning_resources.tasks.get_content_tasks", autospec=True
    )
    with pytest.raises(mocked_celery.replace_exception_class):
        tasks.import_all_oll_files.delay(chunk_size=4)
    get_content_tasks_mock.assert_called_once_with(
        ETLSource.oll.name,
        chunk_size=4,
        overwrite=False,
        learning_resource_ids=None,
    )


@mock_aws
def test_import_content_files(settings, mocker, mocked_celery, mock_blocklist):
    """import_content_files should be replaced with get_content_tasks for any source"""
    setup_s3(settings)
    get_content_tasks_mock = mocker.patch(
        "learning_resources.tasks.get_content_tasks", autospec=True
    )
    with pytest.raises(mocked_celery.replace_exception_class):
        tasks.import_content_files.delay(
            ETLSource.mitxonline.name,
            chunk_size=5,
            overwrite=True,
            learning_resource_ids=[42],
        )
    get_content_tasks_mock.assert_called_once_with(
        ETLSource.mitxonline.name,
        chunk_size=5,
        overwrite=True,
        learning_resource_ids=[42],
    )


@mock_aws
@pytest.mark.parametrize("with_learning_resource_ids", [True, False])
def test_get_content_tasks(
    settings,
    mocker,
    mocked_celery,
    mock_course_archive_bucket,
    with_learning_resource_ids,
):
    """Test that get_content_tasks calls get_content_files with the correct args"""
    mock_get_content_files = mocker.patch(
        "learning_resources.tasks.get_content_files.si"
    )
    mocker.patch("learning_resources.tasks.load_course_blocklist", return_value=[])
    mocker.patch(
        "learning_resources.tasks.get_most_recent_course_archives",
        return_value=["foo.tar.gz"],
    )
    setup_s3(settings)
    settings.LEARNING_COURSE_ITERATOR_CHUNK_SIZE = 2
    etl_source = ETLSource.xpro.name
    platform = PlatformType.xpro.name
    courses = factories.CourseFactory.create_batch(
        3, etl_source=etl_source, platform=platform
    )
    if with_learning_resource_ids:
        learning_resource_ids = sorted(
            [
                courses[0].learning_resource_id,
                courses[1].learning_resource_id,
            ],
            reverse=True,
        )
    else:
        learning_resource_ids = None
    tasks.get_content_tasks(
        etl_source,
        overwrite=True,
        learning_resource_ids=learning_resource_ids,
    )
    assert mocked_celery.group.call_count == 1
    assert (
        models.LearningResource.objects.filter(
            published=True,
            resource_type=LearningResourceType.course.name,
            etl_source=etl_source,
            platform__code=platform,
        )
        .order_by("id")
        .values_list("id", flat=True)
    ).count() == 3
    if with_learning_resource_ids:
        assert mock_get_content_files.call_count == 1
        mock_get_content_files.assert_any_call(
            [learning_resource_ids[0], learning_resource_ids[1]],
            etl_source,
            ["foo.tar.gz"],
            overwrite=True,
        )
    else:
        assert mock_get_content_files.call_count == 2
        mock_get_content_files.assert_any_call(
            ANY, etl_source, ["foo.tar.gz"], overwrite=True
        )


@mock_aws
@pytest.mark.parametrize("test_mode", [True, False])
def test_get_content_tasks_test_mode(
    settings, mocker, mocked_celery, mock_course_archive_bucket, test_mode
):
    """Test that if a resource is marked as in test_mode, it's contentfiles are fetched"""
    mock_get_content_files = mocker.patch(
        "learning_resources.tasks.get_content_files.si"
    )

    mocker.patch("learning_resources.tasks.load_course_blocklist", return_value=[])

    mocker.patch(
        "learning_resources.tasks.get_most_recent_course_archives",
        return_value=["foo.tar.gz"],
    )
    setup_s3(settings)
    settings.LEARNING_COURSE_ITERATOR_CHUNK_SIZE = 10
    etl_source = ETLSource.xpro.name
    platform = PlatformType.xpro.name
    courses = factories.CourseFactory.create_batch(
        3,
        etl_source=etl_source,
        platform=platform,
    )
    learning_resource_ids = []
    for course in courses:
        resource = course.learning_resource
        resource.published = False
        resource.test_mode = test_mode
        resource.save()

        learning_resource_ids.append(resource.id)

    tasks.get_content_tasks(
        etl_source,
        overwrite=True,
    )
    assert mocked_celery.group.call_count == 1
    if test_mode:
        assert sorted(mock_get_content_files.mock_calls[0].args[0]) == sorted(
            learning_resource_ids
        )
    else:
        mock_get_content_files.assert_not_called()


def test_get_content_files(mocker, mock_course_archive_bucket):
    """Test that get_content_files calls sync_edx_course_files with expected parameters"""
    mock_sync_edx_course_files = mocker.patch(
        "learning_resources.tasks.sync_edx_course_files"
    )
    mocker.patch(
        "learning_resources.tasks.get_bucket_by_name",
        return_value=mock_course_archive_bucket.bucket,
    )
    tasks.get_content_files([1, 2], ETLSource.mit_edx.value, ["foo.tar.gz"])
    mock_sync_edx_course_files.assert_called_once_with(
        ETLSource.mit_edx.value, [1, 2], ["foo.tar.gz"], overwrite=False
    )


def test_get_content_files_missing_settings(mocker, settings):
    """Test that get_content_files does nothing without required settings"""
    mock_sync_edx_course_files = mocker.patch(
        "learning_resources.tasks.sync_edx_course_files"
    )
    mock_log = mocker.patch("learning_resources.tasks.log.warning")
    settings.COURSE_ARCHIVE_BUCKET_NAME = None
    source = ETLSource.mit_edx.value
    tasks.get_content_files([1, 2], source, ["foo.tar.gz"])
    mock_sync_edx_course_files.assert_not_called()
    mock_log.assert_called_once_with("Required settings missing for %s files", source)


def test_get_podcast_data(mocker):
    """Verify that get_podcast_data invokes the podcast ETL pipeline with expected params"""
    mock_pipelines = mocker.patch("learning_resources.tasks.pipelines")
    tasks.get_podcast_data.delay()
    mock_pipelines.podcast_etl.assert_called_once()


@mock_aws
@pytest.mark.parametrize(
    ("force_overwrite", "skip_content_files"), [(True, False), (False, True)]
)
@pytest.mark.parametrize(
    "url_substring",
    [
        None,
        "16-01-unified-engineering-i-ii-iii-iv-fall-2005-spring-2006",
        "not-a-match",
    ],
)
def test_get_ocw_data(  # noqa: PLR0913
    settings, mocker, mocked_celery, force_overwrite, skip_content_files, url_substring
):
    """Test get_ocw_data task"""
    setup_s3_ocw(settings)
    get_ocw_courses_mock = mocker.patch(
        "learning_resources.tasks.get_ocw_courses", autospec=True
    )

    if url_substring == "not-a-match":
        error_expectation = does_not_raise()
    else:
        error_expectation = pytest.raises(mocked_celery.replace_exception_class)

    with error_expectation:
        tasks.get_ocw_data.delay(
            force_overwrite=force_overwrite,
            course_url_substring=url_substring,
            skip_content_files=skip_content_files,
        )

    if url_substring == "not-a-match":
        assert mocked_celery.group.call_count == 0
    else:
        assert mocked_celery.group.call_count == 1
        get_ocw_courses_mock.si.assert_called_once_with(
            url_paths=[OCW_TEST_PREFIX],
            force_overwrite=force_overwrite,
            skip_content_files=skip_content_files,
            utc_start_timestamp=None,
        )


def test_get_ocw_data_no_settings(settings, mocker):
    """Test get_ocw_data task without required settings"""
    settings.OCW_LIVE_BUCKET = None
    mock_log = mocker.patch("learning_resources.tasks.log.warning")
    get_ocw_data()
    mock_log.assert_called_once_with("Required settings missing for get_ocw_data")


@mock_aws
@pytest.mark.parametrize("timestamp", [None, "2020-12-15T00:00:00Z"])
@pytest.mark.parametrize("overwrite", [True, False])
def test_get_ocw_courses(settings, mocker, mocked_celery, timestamp, overwrite):
    """
    Test get_ocw_courses
    """
    setup_s3_ocw(settings)
    mocker.patch("learning_resources.etl.loaders.resource_upserted_actions")
    mocker.patch("learning_resources.etl.pipelines.loaders.load_content_files")
    mocker.patch("learning_resources.etl.ocw.transform_content_files")
    tasks.get_ocw_courses.delay(
        url_paths=[OCW_TEST_PREFIX],
        force_overwrite=overwrite,
        skip_content_files=False,
        utc_start_timestamp=timestamp,
    )

    assert models.LearningResource.objects.count() == 1
    assert models.Course.objects.count() == 1
    assert models.LearningResourceInstructor.objects.count() == 10

    course_resource = models.Course.objects.first().learning_resource
    assert course_resource.title == "Unified Engineering I, II, III, & IV"
    assert course_resource.readable_id == "16.01+fall_2005"
    assert course_resource.runs.count() == 1
    assert course_resource.runs.first().run_id == "97db384ef34009a64df7cb86cf701979"
    assert (
        course_resource.runs.first().slug
        == "courses/16-01-unified-engineering-i-ii-iii-iv-fall-2005-spring-2006"
    )


@pytest.mark.parametrize("channel_ids", [["abc", "123"], None])
def test_get_youtube_data(mocker, settings, channel_ids):
    """Verify that the get_youtube_data invokes the YouTube ETL pipeline with expected params"""
    mock_pipelines = mocker.patch("learning_resources.tasks.pipelines")
    get_youtube_data.delay(channel_ids=channel_ids)
    mock_pipelines.youtube_etl.assert_called_once_with(channel_ids=channel_ids)


def test_get_youtube_transcripts(mocker):
    """Verify that get_youtube_transcripts invokes correct course_catalog.etl.youtube functions"""

    mock_etl_youtube = mocker.patch("learning_resources.tasks.youtube")

    get_youtube_transcripts(created_after=None, created_minutes=2000, overwrite=True)

    mock_etl_youtube.get_youtube_videos_for_transcripts_job.assert_called_once_with(
        created_after=None, created_minutes=2000, overwrite=True
    )

    mock_etl_youtube.get_youtube_transcripts.assert_called_once_with(
        mock_etl_youtube.get_youtube_videos_for_transcripts_job.return_value
    )


@pytest.mark.parametrize("published", [True, False])
def test_update_next_start_date(mocker, published):
    learning_resource = LearningResourceFactory.create(
        next_start_date=(timezone.now() - timedelta(10)),
        published=published,
    )
    LearningResourceFactory.create(next_start_date=(timezone.now() + timedelta(1)))

    mock_load_next_start_date = mocker.patch(
        "learning_resources.tasks.load_run_dependent_values"
    )
    mock_upsert_index = mocker.patch(
        "learning_resources.tasks.resource_upserted_actions"
    )
    update_next_start_date_and_prices()
    mock_load_next_start_date.assert_called_once_with(learning_resource)
    if published:
        mock_upsert_index.assert_called_once_with(
            learning_resource, percolate=False, generate_embeddings=True
        )
    else:
        mock_upsert_index.assert_not_called()


@pytest.mark.parametrize(
    ("chunk_size", "overwrite", "ids"),
    [
        (None, False, []),  # Default params
        (10, True, [1, 2, 3]),  # Custom params
        (5, False, [42, 99]),  # Another variation
    ],
)
def test_summarize_unprocessed_content(
    mocker, mocked_celery, chunk_size, overwrite, ids
):
    """Test that summarize_unprocessed_content calls the correct methods"""
    summarize_content_files_task_mock = mocker.patch(
        "learning_resources.tasks.summarize_content_files_task", autospec=True
    )
    get_unprocessed_content_file_ids_mock = mocker.patch(
        "learning_resources.tasks.ContentSummarizer.get_unprocessed_content_file_ids",
        autospec=True,
        return_value=ids,
    )
    error_expectation = pytest.raises(mocked_celery.replace_exception_class)
    with error_expectation:
        tasks.summarize_unprocessed_content.delay(
            unprocessed_content_ids=ids, overwrite=overwrite
        )

    assert mocked_celery.group.call_count == 1
    if ids:
        summarize_content_files_task_mock.si.assert_called_once_with(
            content_file_ids=ids, overwrite=overwrite
        )
    assert get_unprocessed_content_file_ids_mock.call_count == 0 if ids else 1


@pytest.mark.django_db
def test_marketing_page_for_resources_with_webdriver(mocker, settings):
    """Test that marketing_page_for_resources uses WebDriver to fetch content"""

    settings.EMBEDDINGS_EXTERNAL_FETCH_USE_WEBDRIVER = True

    course = models.LearningResource.objects.create(
        title="Test Course",
        url="https://example.com/course",
        resource_type="course",
        published=True,
    )

    html_content = "<html><body><h1>Test Course</h1><p>Course content</p></body></html>"
    mock_fetch_page = mocker.patch(
        "learning_resources.site_scrapers.base_scraper.BaseScraper.fetch_page",
        return_value=html_content,
    )

    markdown_content = "# Test Course\n\nCourse content"
    mock_html_to_markdown = mocker.patch(
        "learning_resources.tasks.html_to_markdown", return_value=markdown_content
    )

    marketing_page_for_resources([course.id])

    mock_fetch_page.assert_called_once_with(course.url)
    mock_html_to_markdown.assert_called_once_with(html_content)

    # Verify that a content file was created
    content_file = models.ContentFile.objects.get(
        learning_resource=course, file_type=MARKETING_PAGE_FILE_TYPE
    )
    assert content_file.key == course.url
    assert content_file.url == course.url
    assert content_file.content == markdown_content
    assert content_file.file_extension == ".md"


@pytest.mark.django_db
def test_scrape_marketing_pages(mocker, settings, mocked_celery):
    """Test that scrape_marketing_pages correctly identifies resources without marketing pages"""

    settings.EMBEDDINGS_EXTERNAL_FETCH_USE_WEBDRIVER = True
    settings.QDRANT_CHUNK_SIZE = 2

    course1 = models.LearningResource.objects.create(
        title="Course 1",
        url="https://example.com/course1",
        resource_type="course",
        published=True,
    )
    course2 = models.LearningResource.objects.create(
        title="Course 2",
        url="https://example.com/course2",
        resource_type="course",
        published=True,
    )

    course3 = models.LearningResource.objects.create(
        title="Course 3",
        url="https://example.com/course3",
        resource_type="course",
        published=True,
    )
    models.ContentFile.objects.create(
        learning_resource=course3,
        file_type=MARKETING_PAGE_FILE_TYPE,
        key=course3.url,
        content="Existing content",
        file_extension=".md",
    )

    models.LearningResource.objects.create(
        title="Unpublished Course",
        url="https://example.com/unpublished",
        resource_type="course",
        published=False,
    )

    mock_group = mocker.patch("learning_resources.tasks.celery.group")
    mock_marketing_page_task = mocker.patch(
        "learning_resources.tasks.marketing_page_for_resources.si"
    )
    with pytest.raises(mocked_celery.replace_exception_class):
        scrape_marketing_pages.delay()

    # Verify that only resources without marketing pages are included
    expected_ids = [course1.id, course2.id]
    assert all(
        eid in mock_marketing_page_task.mock_calls[0].args[0] for eid in expected_ids
    )
    mock_group.assert_called_once()


@pytest.mark.parametrize("canvas_ids", [["1"], None])
def test_sync_canvas_courses(settings, mocker, django_assert_num_queries, canvas_ids):
    """
    sync_canvas_courses should unpublish and delete stale canvas LearningResources
    """
    settings.CANVAS_COURSE_BUCKET_PREFIX = "canvas/"
    mocker.patch("learning_resources.tasks.resource_unpublished_actions")
    mock_bucket = mocker.Mock()
    mock_archive1 = mocker.Mock()
    mock_archive1.key = "canvas/1/archive1.imscc"
    mock_archive1.last_modified = now_in_utc()
    mock_archive2 = mocker.Mock()
    mock_archive2.key = "canvas/2/archive2.imscc"
    mock_archive2.last_modified = now_in_utc() - timedelta(days=1)
    mock_bucket.objects.filter.return_value = [mock_archive1, mock_archive2]
    mocker.patch(
        "learning_resources.tasks.get_bucket_by_name", return_value=mock_bucket
    )

    # Create two canvas LearningResources - one stale

    lr1 = LearningResourceFactory.create(
        readable_id="course1",
        etl_source=ETLSource.canvas.name,
        published=True,
        test_mode=True,
        resource_type="course",
    )
    lr2 = LearningResourceFactory.create(
        readable_id="course2",
        etl_source=ETLSource.canvas.name,
        published=True,
        test_mode=True,
        resource_type="course",
    )
    lr_stale = LearningResourceFactory.create(
        readable_id="course3",
        etl_source=ETLSource.canvas.name,
        published=True,
        test_mode=True,
        resource_type="course",
    )

    # Patch ingest_canvas_course to return the readable_ids for the two non-stale courses
    mock_ingest_course = mocker.patch(
        "learning_resources.tasks.ingest_canvas_course",
        side_effect=["course1", "course2"],
    )
    sync_canvas_courses(canvas_course_ids=canvas_ids, overwrite=False)

    # The stale course should be unpublished and deleted
    if canvas_ids:
        assert LearningResource.objects.filter(id=lr_stale.id).exists()
    else:
        assert not LearningResource.objects.filter(id=lr_stale.id).exists()
    # The non-stale courses should still exist
    assert LearningResource.objects.filter(id=lr1.id).exists()
    assert LearningResource.objects.filter(id=lr2.id).exists()

    if canvas_ids:
        assert mock_ingest_course.call_count == 1
    else:
        assert mock_ingest_course.call_count == 2


def test_remove_duplicate_resources(mocker, mocked_celery):
    """
    Test that remove_duplicate_resources removes duplicate unpublished resources
    while keeping the most recently created resource.
    """
    duplicate_id = "duplicate_id"

    for platform_type in [PlatformType.edx, PlatformType.xpro, PlatformType.youtube]:
        LearningResourceFactory.create(
            readable_id=duplicate_id,
            published=False,
            platform=LearningResourcePlatformFactory.create(code=platform_type.name),
        )

    published_reasource = LearningResourceFactory.create(
        readable_id=duplicate_id,
        published=True,
        platform=LearningResourcePlatformFactory.create(
            code=platform_type.mitxonline.name
        ),
    )
    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
    )
    assert LearningResource.objects.filter(readable_id=duplicate_id).count() == 4
    with pytest.raises(mocked_celery.replace_exception_class):
        remove_duplicate_resources()
    assert generate_embeddings_mock.mock_calls[0].args[0] == [published_reasource.id]
    assert LearningResource.objects.filter(readable_id=duplicate_id).count() == 1


@pytest.mark.parametrize(
    ("etl_source", "archive_path", "overwrite"),
    [
        (
            ETLSource.mitxonline.name,
            "mitxonline/courses/course-v1:Test+Course+R1/abcdefghijklmnop.tar.gz",
            False,
        ),
        (
            ETLSource.xpro.name,
            "xpro/courses/course-v1:xPRO+Test+R1/qrstuvwxyz.tar.gz",
            True,
        ),
        (
            ETLSource.mit_edx.name,
            "edxorg-raw-data/courses/MITx-1.00x-1T2022/abcdefghijklmnop.tar.gz",
            False,
        ),
        (
            ETLSource.oll.name,
            "open-learning-library/courses/20220101/course-v1:OLL+Test+R1_OLL.tar.gz",
            True,
        ),
    ],
)
def test_ingest_edx_course(mocker, etl_source, archive_path, overwrite):
    """Test ingest_edx_course task calls sync_edx_archive with correct parameters"""
    from learning_resources.tasks import ingest_edx_course

    mock_sync = mocker.patch("learning_resources.tasks.sync_edx_archive")

    ingest_edx_course(etl_source, archive_path, overwrite=overwrite)

    mock_sync.assert_called_once_with(
        etl_source, archive_path, course_id=None, overwrite=overwrite
    )
