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
from learning_resources.etl.exceptions import ExtractException
from learning_resources.factories import (
    ContentFileFactory,
    LearningResourceFactory,
    LearningResourceRunFactory,
)
from learning_resources.models import ContentFile, LearningResource
from learning_resources.tasks import (
    cleanup_deleted_content_files,
    get_ocw_data,
    get_youtube_channel_data,
    get_youtube_data,
    get_youtube_playlist_data,
    get_youtube_transcripts,
    marketing_page_for_resources,
    scrape_marketing_pages,
    sync_canvas_courses,
    unpublish_removed_canvas_courses,
    update_next_start_date_and_prices,
    update_ocw_learning_material_resources,
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

    # get_youtube_data is absent on purpose: it only queues the fan-out, whose
    # writes land long after it returns, so it has nothing to invalidate
    tasks.get_youtube_transcripts.delay()
    assert mocked_clear_views_cache.call_count == 9


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


@pytest.fixture
def youtube_settings(settings):
    """Configure youtube ETL settings"""
    settings.YOUTUBE_CONFIG_URL = "http://test.youtube/config.yaml"
    settings.YOUTUBE_DEVELOPER_KEY = "key"
    return settings


def _channel_config(channel_id, **kwargs):
    """Build a youtube channel config"""
    return {"channel_id": channel_id, "offered_by": "ocw", **kwargs}


def _playlist_data(playlist_id):
    """Build the raw youtube api data for a playlist"""
    return {
        "id": playlist_id,
        "snippet": {
            "title": f"Playlist {playlist_id}",
            "thumbnails": {"high": {"url": f"http://img/{playlist_id}.jpg"}},
        },
    }


@pytest.mark.parametrize("channel_ids", [["channel1"], None])
def test_get_youtube_data(mocker, youtube_settings, channel_ids):
    """get_youtube_data should queue one task per configured channel"""
    channel_configs = [_channel_config("channel1"), _channel_config("channel2")]
    mock_configs = mocker.patch(
        "learning_resources.tasks.youtube.get_youtube_channel_configs",
        autospec=True,
        return_value=channel_configs,
    )
    mock_unpublish = mocker.patch(
        "learning_resources.tasks.loaders.unpublish_removed_youtube_channels",
        autospec=True,
    )
    mock_channel_task = mocker.patch(
        "learning_resources.tasks.get_youtube_channel_data", autospec=True
    )

    assert get_youtube_data.delay(channel_ids=channel_ids).get() == 2

    mock_configs.assert_called_once_with(channel_ids=channel_ids)
    assert [
        call.args[0] for call in mock_channel_task.delay.call_args_list
    ] == channel_configs

    if channel_ids:
        # a run filtered to specific channels doesn't know the full channel set,
        # so it must not unpublish the channels it wasn't asked about
        mock_unpublish.assert_not_called()
    else:
        mock_unpublish.assert_called_once_with(["channel1", "channel2"])


def test_get_youtube_data_without_configs_does_not_unpublish(mocker, youtube_settings):
    """An empty channel config should be treated as a failure, not as "no channels\""""
    mocker.patch(
        "learning_resources.tasks.youtube.get_youtube_channel_configs",
        autospec=True,
        return_value=[],
    )
    mock_unpublish = mocker.patch(
        "learning_resources.tasks.loaders.unpublish_removed_youtube_channels",
        autospec=True,
    )
    mock_channel_task = mocker.patch(
        "learning_resources.tasks.get_youtube_channel_data", autospec=True
    )

    assert get_youtube_data.delay().get() == 0

    mock_unpublish.assert_not_called()
    mock_channel_task.delay.assert_not_called()


@pytest.mark.parametrize("setting", ["YOUTUBE_CONFIG_URL", "YOUTUBE_DEVELOPER_KEY"])
def test_get_youtube_data_missing_settings(mocker, youtube_settings, setting):
    """A missing youtube setting should stop the run before any extraction"""
    setattr(youtube_settings, setting, None)
    mock_configs = mocker.patch(
        "learning_resources.tasks.youtube.get_youtube_channel_configs", autospec=True
    )
    mock_unpublish = mocker.patch(
        "learning_resources.tasks.loaders.unpublish_removed_youtube_channels",
        autospec=True,
    )

    assert get_youtube_data.delay().get() == 0

    mock_configs.assert_not_called()
    mock_unpublish.assert_not_called()


def test_get_youtube_channel_data(mocker, youtube_settings):
    """A channel task should load the channel and queue a task per playlist"""
    mocker.patch("learning_resources.tasks.youtube.get_youtube_client", autospec=True)
    mocker.patch(
        "learning_resources.tasks.youtube.extract_channel",
        autospec=True,
        return_value={"id": "channel1", "snippet": {"title": "Channel 1"}},
    )
    playlists = [_playlist_data("playlist1"), _playlist_data("playlist2")]
    mocker.patch(
        "learning_resources.tasks.youtube.extract_playlist_metadata",
        autospec=True,
        return_value=iter([(playlists[0], True), (playlists[1], False)]),
    )
    mock_unpublish = mocker.patch(
        "learning_resources.tasks.loaders.unpublish_removed_playlists", autospec=True
    )
    mock_playlist_task = mocker.patch(
        "learning_resources.tasks.get_youtube_playlist_data", autospec=True
    )

    get_youtube_channel_data.delay(_channel_config("channel1"))

    video_channel = models.VideoChannel.objects.get(channel_id="channel1")
    assert video_channel.title == "Channel 1"
    assert video_channel.published is True
    assert video_channel.etl_source == ETLSource.youtube.name

    # the full playlist listing is resolved before anything is unpublished
    mock_unpublish.assert_called_once_with(video_channel, ["playlist1", "playlist2"])

    assert [
        (call.args, call.kwargs) for call in mock_playlist_task.delay.call_args_list
    ] == [
        (("channel1", playlists[0], "ocw"), {"create_videos": True}),
        (("channel1", playlists[1], "ocw"), {"create_videos": False}),
    ]


def test_get_youtube_channel_data_missing_from_youtube(mocker, youtube_settings):
    """A channel youtube no longer returns should be left alone"""
    mocker.patch("learning_resources.tasks.youtube.get_youtube_client", autospec=True)
    mocker.patch(
        "learning_resources.tasks.youtube.extract_channel",
        autospec=True,
        return_value=None,
    )
    mock_unpublish = mocker.patch(
        "learning_resources.tasks.loaders.unpublish_removed_playlists", autospec=True
    )
    mock_playlist_task = mocker.patch(
        "learning_resources.tasks.get_youtube_playlist_data", autospec=True
    )

    get_youtube_channel_data.delay(_channel_config("channel1"))

    assert models.VideoChannel.objects.count() == 0
    mock_unpublish.assert_not_called()
    mock_playlist_task.delay.assert_not_called()


def test_get_youtube_channel_data_extract_error_keeps_playlists(
    mocker, youtube_settings
):
    """A failed playlist listing must not unpublish the channel's playlists"""
    mocker.patch("learning_resources.tasks.youtube.get_youtube_client", autospec=True)
    mocker.patch(
        "learning_resources.tasks.youtube.extract_channel",
        autospec=True,
        return_value={"id": "channel1", "snippet": {"title": "Channel 1"}},
    )
    mocker.patch(
        "learning_resources.tasks.youtube.extract_playlist_metadata",
        autospec=True,
        side_effect=ExtractException("boom"),
    )
    mock_unpublish = mocker.patch(
        "learning_resources.tasks.loaders.unpublish_removed_playlists", autospec=True
    )

    with pytest.raises(ExtractException):
        get_youtube_channel_data.delay(_channel_config("channel1"))

    mock_unpublish.assert_not_called()


def test_get_youtube_playlist_data(mocker, youtube_settings):
    """A playlist task should transform and load only its own playlist"""
    video_channel = factories.VideoChannelFactory.create(channel_id="channel1")
    mocker.patch("learning_resources.tasks.youtube.get_youtube_client", autospec=True)
    mock_videos = mocker.patch(
        "learning_resources.tasks.youtube.extract_playlist_items", autospec=True
    )
    mock_load_playlist = mocker.patch(
        "learning_resources.tasks.loaders.load_playlist", autospec=True
    )

    get_youtube_playlist_data.delay(
        "channel1", _playlist_data("playlist1"), "ocw", create_videos=True
    )

    mock_videos.assert_called_once_with(ANY, "playlist1")
    loaded_channel, playlist_data = mock_load_playlist.call_args.args
    assert loaded_channel == video_channel
    assert playlist_data["playlist_id"] == "playlist1"
    assert playlist_data["create_videos"] is True
    assert playlist_data["offered_by"] == {"code": "ocw"}


def test_get_youtube_playlist_data_without_channel(mocker, youtube_settings):
    """A playlist whose channel vanished mid-run should be skipped, not crash"""
    mocker.patch("learning_resources.tasks.youtube.get_youtube_client", autospec=True)
    mock_load_playlist = mocker.patch(
        "learning_resources.tasks.loaders.load_playlist", autospec=True
    )

    get_youtube_playlist_data.delay(
        "channel1", _playlist_data("playlist1"), "ocw", create_videos=True
    )

    mock_load_playlist.assert_not_called()


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


def test_get_ovs_data(mocker):
    """Verify that get_ovs_data invokes the OVS ETL pipeline"""
    mock_pipelines = mocker.patch("learning_resources.tasks.pipelines")
    mock_pipelines.ovs_etl.return_value = iter([])
    tasks.get_ovs_data.delay()
    mock_pipelines.ovs_etl.assert_called_once()


def test_get_ovs_transcripts(mocker):
    """Verify that get_ovs_transcripts invokes correct OVS ETL functions"""

    mock_etl_ovs = mocker.patch("learning_resources.tasks.ovs")

    tasks.get_ovs_transcripts(overwrite=True)

    mock_etl_ovs.get_ovs_videos_for_transcripts_job.assert_called_once_with(
        overwrite=True
    )

    mock_etl_ovs.get_ovs_transcripts.assert_called_once_with(
        mock_etl_ovs.get_ovs_videos_for_transcripts_job.return_value
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
        "learning_resources.content_summarizer.ContentSummarizer.get_unprocessed_content_file_ids",
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

    mock_generate_embeddings = mocker.patch("vector_search.tasks.generate_embeddings")
    mock_upsert_content_file = mocker.patch(
        "learning_resources_search.tasks.upsert_content_file"
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

    # Verify embeddings were triggered
    mock_generate_embeddings.delay.assert_called_once_with(
        [content_file.id], "content_file", overwrite=True
    )

    # Verify the search index upsert was triggered
    mock_upsert_content_file.delay.assert_called_once_with(content_file.id)


@pytest.mark.django_db
def test_marketing_page_for_resources_isolates_scrape_failures(mocker):
    """A single resource's scrape failure must not fail the whole chunk.

    When course and program tasks are chained, a chunk that raises poisons the
    chord header and the program group never runs, so per-resource failures are
    logged and skipped rather than propagated.
    """
    bad_course = models.LearningResource.objects.create(
        title="Bad Course",
        url="https://example.com/bad-course",
        resource_type="course",
        published=True,
    )
    good_course = models.LearningResource.objects.create(
        title="Good Course",
        url="https://example.com/good-course",
        resource_type="course",
        published=True,
    )

    good_scraper = mocker.Mock()
    good_scraper.scrape.return_value = "<html><body><p>ok</p></body></html>"

    def fake_scraper_for_site(url):
        if url == bad_course.url:
            msg = "scraper boom"
            raise RuntimeError(msg)
        return good_scraper

    mocker.patch(
        "learning_resources.tasks.scraper_for_site",
        side_effect=fake_scraper_for_site,
    )
    mocker.patch("learning_resources.tasks.html_to_markdown", return_value="ok")
    mock_generate_embeddings = mocker.patch("vector_search.tasks.generate_embeddings")
    mock_upsert_content_file = mocker.patch(
        "learning_resources_search.tasks.upsert_content_file"
    )

    # Must not raise despite the bad course failing
    marketing_page_for_resources([bad_course.id, good_course.id])

    assert not models.ContentFile.objects.filter(learning_resource=bad_course).exists()
    good_cf = models.ContentFile.objects.get(
        learning_resource=good_course, file_type=MARKETING_PAGE_FILE_TYPE
    )
    mock_generate_embeddings.delay.assert_called_once_with(
        [good_cf.id], "content_file", overwrite=True
    )
    mock_upsert_content_file.delay.assert_called_once_with(good_cf.id)


@pytest.mark.django_db
def test_marketing_page_for_program_appends_children(mocker, settings):
    """Test that marketing_page_for_resources appends program children content"""

    settings.EMBEDDINGS_EXTERNAL_FETCH_USE_WEBDRIVER = True

    program = models.LearningResource.objects.create(
        title="Test Program",
        url="https://example.com/program",
        resource_type="program",
        published=True,
    )
    models.Program.objects.create(learning_resource=program)

    child_course = models.LearningResource.objects.create(
        title="Child Course",
        url="https://example.com/child-course",
        resource_type="course",
        description="A child course description",
        published=True,
    )
    models.LearningResourceRelationship.objects.create(
        parent=program,
        child=child_course,
        relation_type="PROGRAM_COURSES",
        position=0,
    )
    models.ContentFile.objects.create(
        learning_resource=child_course,
        file_type=MARKETING_PAGE_FILE_TYPE,
        file_extension=".md",
        key="mktg-child-course",
        content="Child Course marketing copy",
        published=True,
    )

    html_content = "<html><body><h1>Test Program</h1><p>Program info</p></body></html>"
    mocker.patch(
        "learning_resources.site_scrapers.base_scraper.BaseScraper.fetch_page",
        return_value=html_content,
    )

    markdown_content = "# Test Program\n\nProgram info"
    mocker.patch(
        "learning_resources.tasks.html_to_markdown", return_value=markdown_content
    )

    mock_generate_embeddings = mocker.patch("vector_search.tasks.generate_embeddings")
    mock_upsert_content_file = mocker.patch(
        "learning_resources_search.tasks.upsert_content_file"
    )

    marketing_page_for_resources([program.id])

    content_file = models.ContentFile.objects.get(
        learning_resource=program, file_type=MARKETING_PAGE_FILE_TYPE
    )
    assert content_file.content.startswith(markdown_content)
    assert "## Program Contents" in content_file.content
    assert "Child Course" in content_file.content

    # Verify embeddings were triggered
    mock_generate_embeddings.delay.assert_called_once_with(
        [content_file.id], "content_file", overwrite=True
    )

    # Program marketing pages should be upserted to the search index as well
    mock_upsert_content_file.delay.assert_called_once_with(content_file.id)


@pytest.mark.django_db
def test_marketing_page_for_non_program_skips_children_content(mocker, settings):
    """Non-program resources should not invoke program children aggregation."""
    settings.EMBEDDINGS_EXTERNAL_FETCH_USE_WEBDRIVER = True

    course = models.LearningResource.objects.create(
        title="Test Course",
        url="https://example.com/course-no-children",
        resource_type="course",
        published=True,
    )

    html_content = "<html><body><h1>Test Course</h1><p>Course content</p></body></html>"
    mocker.patch(
        "learning_resources.site_scrapers.base_scraper.BaseScraper.fetch_page",
        return_value=html_content,
    )
    markdown_content = "# Test Course\n\nCourse content"
    mocker.patch(
        "learning_resources.tasks.html_to_markdown", return_value=markdown_content
    )

    children_content_mock = mocker.patch(
        "learning_resources.tasks.build_program_children_content_bulk",
        return_value={},
    )
    mock_generate_embeddings = mocker.patch("vector_search.tasks.generate_embeddings")
    mocker.patch("learning_resources_search.tasks.upsert_content_file")

    marketing_page_for_resources([course.id])

    children_content_mock.assert_not_called()

    content_file = models.ContentFile.objects.get(
        learning_resource=course, file_type=MARKETING_PAGE_FILE_TYPE
    )
    assert content_file.content == markdown_content
    mock_generate_embeddings.delay.assert_called_once_with(
        [content_file.id], "content_file", overwrite=True
    )


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


@pytest.mark.django_db
def test_scrape_marketing_pages_orders_courses_before_programs(
    mocker, settings, mocked_celery
):
    """Courses are scraped in a group that runs before the programs group."""
    settings.QDRANT_CHUNK_SIZE = 10
    course = models.LearningResource.objects.create(
        title="Course",
        url="https://example.com/course",
        resource_type="course",
        published=True,
    )
    program = models.LearningResource.objects.create(
        title="Program",
        url="https://example.com/program",
        resource_type="program",
        published=True,
    )
    si_mock = mocker.patch("learning_resources.tasks.marketing_page_for_resources.si")
    # Make each .si(...) call's return value identify which ids it was built
    # from, so the args passed into celery.group(...) can be told apart.
    si_mock.side_effect = lambda ids: ("si", tuple(ids))

    with pytest.raises(mocked_celery.replace_exception_class):
        scrape_marketing_pages.delay()

    # A chain enforces ordering (not a single flat group).
    assert mocked_celery.chain.called
    # Course task built before program task; each in its own chunk here.
    queued_ids = [call.args[0] for call in si_mock.call_args_list]
    assert queued_ids[0] == [course.id]
    assert [program.id] in queued_ids
    assert queued_ids.index([course.id]) < queued_ids.index([program.id])

    # Pin the guarantee to what is actually fed into celery.chain via
    # celery.group: Python evaluates chain's positional args left-to-right,
    # so the first group(...) call must be the course tasks and the second
    # must be the program tasks. This fails if the two arguments to
    # celery.chain(celery.group(...), celery.group(...)) are ever swapped.
    assert mocked_celery.group.call_count == 2
    first_group_tasks, second_group_tasks = (
        call.args[0] for call in mocked_celery.group.call_args_list
    )
    assert first_group_tasks == [("si", (course.id,))]
    assert second_group_tasks == [("si", (program.id,))]


@pytest.mark.django_db
def test_scrape_marketing_pages_queues_healable_programs(
    mocker, settings, mocked_celery
):
    """A program that already has a page but is missing its children section
    (with a child course page available) is queued for re-scrape.
    """
    settings.QDRANT_CHUNK_SIZE = 10
    course = models.LearningResource.objects.create(
        title="Course",
        url="https://example.com/course",
        resource_type="course",
        published=True,
    )
    ContentFile.objects.create(
        learning_resource=course,
        file_type=MARKETING_PAGE_FILE_TYPE,
        file_extension=".md",
        key=course.url,
        content="Child copy.",
        published=True,
    )
    program = models.LearningResource.objects.create(
        title="Program",
        url="https://example.com/program",
        resource_type="program",
        published=True,
    )
    models.LearningResourceRelationship.objects.create(
        parent=program, child=course, relation_type="PROGRAM_COURSES"
    )
    # Program already has a page, but WITHOUT the children marker.
    ContentFile.objects.create(
        learning_resource=program,
        file_type=MARKETING_PAGE_FILE_TYPE,
        file_extension=".md",
        key=program.url,
        content="Program page, no children yet.",
        published=True,
    )
    si_mock = mocker.patch("learning_resources.tasks.marketing_page_for_resources.si")

    with pytest.raises(mocked_celery.replace_exception_class):
        scrape_marketing_pages.delay()

    queued_ids = [i for call in si_mock.call_args_list for i in call.args[0]]
    # Program re-queued for healing; course already has a page so it is NOT queued.
    assert program.id in queued_ids
    assert course.id not in queued_ids


@pytest.fixture
def canvas_archive_bucket(settings, mocker):
    """Mock an S3 bucket holding one archive each for canvas folders 1 and 2"""
    settings.CANVAS_COURSE_BUCKET_PREFIX = "canvas/"
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
    return mock_bucket


@pytest.mark.parametrize("canvas_ids", [["1"], None])
def test_sync_canvas_courses(mocker, mocked_celery, canvas_archive_bucket, canvas_ids):
    """
    sync_canvas_courses should queue one ingest task per archive rather than
    importing the courses inline
    """
    delay_mock = mocker.patch("learning_resources.tasks.ingest_canvas_course.delay")
    sweep_mock = mocker.patch(
        "learning_resources.tasks.unpublish_removed_canvas_courses"
    )

    queued = sync_canvas_courses.delay(
        canvas_course_ids=canvas_ids, overwrite=False
    ).get()

    queued_keys = [call.args[0] for call in delay_mock.call_args_list]
    if canvas_ids:
        # a filtered run only queues the courses it was asked for, and doesn't
        # list every archive, so it must not sweep
        assert queued_keys == ["canvas/1/archive1.imscc"]
        assert sweep_mock.call_count == 0
    else:
        assert sorted(queued_keys) == [
            "canvas/1/archive1.imscc",
            "canvas/2/archive2.imscc",
        ]
        # the sweep is driven by the listing, and runs before the fan-out so a
        # culled import can't hold it up
        assert sorted(sweep_mock.call_args.args[0]) == ["1", "2"]
    assert queued == len(queued_keys)
    # the imports are independent tasks - nothing waits on them, so the sync
    # must not build a group/chord just to fan out
    assert mocked_celery.group.call_count == 0
    assert mocked_celery.replace.call_count == 0


def test_sync_canvas_courses_no_archives(mocker, mocked_celery, canvas_archive_bucket):
    """
    An empty bucket listing should queue nothing and sweep nothing, rather than
    reading as "canvas offers no courses" and deleting the catalog
    """
    canvas_archive_bucket.objects.filter.return_value = []
    delay_mock = mocker.patch("learning_resources.tasks.ingest_canvas_course.delay")
    sweep_mock = mocker.patch(
        "learning_resources.tasks.unpublish_removed_canvas_courses"
    )

    assert sync_canvas_courses.delay(overwrite=False).get() is None

    assert delay_mock.call_count == 0
    assert sweep_mock.call_count == 0
    assert mocked_celery.group.call_count == 0
    assert mocked_celery.replace.call_count == 0


def test_unpublish_removed_canvas_courses(mocker):
    """
    unpublish_removed_canvas_courses should delete canvas resources whose course
    folder is no longer in the S3 listing, matching on the readable id prefix
    """
    mock_unpublished_actions = mocker.patch(
        "learning_resources.tasks.resource_unpublished_actions"
    )
    lr1, lr2, lr_stale = (
        LearningResourceFactory.create(
            readable_id=readable_id,
            etl_source=ETLSource.canvas.name,
            published=True,
            test_mode=True,
            resource_type="course",
        )
        # folder "1" must not match folder "12"'s course, hence the trailing "-"
        for readable_id in ("1-COURSE1", "12-COURSE12", "3-COURSE3")
    )
    other_source = LearningResourceFactory.create(
        readable_id="3-COURSE3-edx",
        etl_source=ETLSource.mit_edx.name,
        published=True,
        resource_type="course",
    )

    assert unpublish_removed_canvas_courses(["1", "12"]) == 1

    assert not LearningResource.objects.get(id=lr_stale.id).published
    assert LearningResource.objects.filter(id=lr1.id).exists()
    assert LearningResource.objects.filter(id=lr2.id).exists()
    assert LearningResource.objects.filter(id=other_source.id).exists()
    assert mock_unpublished_actions.call_count == 1
    # the hook skips content files on a test_mode resource, so it must be handed
    # the resource as it is after the unpublish, not as it was before
    unpublished = mock_unpublished_actions.call_args.args[0]
    assert unpublished.id == lr_stale.id
    assert unpublished.test_mode is False
    assert unpublished.published is False


def test_unpublish_removed_canvas_courses_none_stale(mocker):
    """
    A listing covering every course folder should delete nothing, without
    unpublishing the courses it is keeping
    """
    mock_unpublished_actions = mocker.patch(
        "learning_resources.tasks.resource_unpublished_actions"
    )
    resource = LearningResourceFactory.create(
        readable_id="1-COURSE1",
        etl_source=ETLSource.canvas.name,
        published=True,
        test_mode=True,
        resource_type="course",
    )

    assert unpublish_removed_canvas_courses(["1"]) == 0

    resource.refresh_from_db()
    assert resource.published is True
    assert resource.test_mode is True
    assert mock_unpublished_actions.call_count == 0


def test_unpublish_removed_canvas_courses_empty(mocker):
    """
    A listing that came back empty should leave every canvas course alone rather
    than deleting the whole catalog
    """
    mocker.patch("learning_resources.tasks.resource_unpublished_actions")
    resource = LearningResourceFactory.create(
        readable_id="1-COURSE1",
        etl_source=ETLSource.canvas.name,
        published=True,
        test_mode=True,
        resource_type="course",
    )

    assert unpublish_removed_canvas_courses([]) == 0

    resource.refresh_from_db()
    assert resource.published is True
    assert resource.test_mode is True


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
    from learning_resources.tasks import ingest_edx_run_archive

    run_id = "course-v1:Test+Course+R1"
    mock_sync = mocker.patch("learning_resources.tasks.sync_edx_archive")

    ingest_edx_run_archive(etl_source, archive_path, run_id=run_id, overwrite=overwrite)

    mock_sync.assert_called_once_with(
        etl_source, archive_path, run_id=run_id, overwrite=overwrite
    )


def test_update_ocw_learning_material_resources(mocker, settings):
    """
    Test that update_ocw_learning_material_resources calls the correct loader method
    """
    ocw_resource = LearningResourceFactory.create(
        etl_source=ETLSource.ocw.name,
        resource_type=LearningResourceType.course.name,
        published=True,
    )

    ContentFileFactory.create_batch(
        2,
        run=ocw_resource.runs.first(),
    )

    content_file_ids = set(
        ocw_resource.runs.first().content_files.values_list("id", flat=True)
    )

    mock_load_learning_materials = mocker.patch(
        "learning_resources.tasks.load_learning_materials", autospec=True
    )

    update_ocw_learning_material_resources()

    mock_load_learning_materials.assert_called_once()
    call_args = mock_load_learning_materials.call_args[0]
    assert call_args[0] == ocw_resource.runs.first()
    assert set(call_args[1]) == content_file_ids


def test_cleanup_deleted_content_files_respects_retention_window(settings):
    """
    cleanup_deleted_content_files should only delete soft-deleted files past
    the retention window, only for sources in RESOURCE_FILE_ETL_SOURCES, and
    should chunk its deletes.
    """
    settings.CONTENT_FILE_RETENTION_DAYS = 14
    settings.CONTENT_FILE_CLEANUP_CHUNK_SIZE = 2

    eligible_run = LearningResourceRunFactory.create(
        published=True, learning_resource__etl_source=ETLSource.mitxonline.value
    )
    ineligible_run = LearningResourceRunFactory.create(
        published=True, learning_resource__etl_source=ETLSource.youtube.value
    )

    old_cutoff = now_in_utc() - timedelta(days=15)
    recent_cutoff = now_in_utc() - timedelta(days=1)

    old_unpublished = ContentFileFactory.create_batch(
        3, run=eligible_run, published=False
    )
    recent_unpublished = ContentFileFactory.create_batch(
        1, run=eligible_run, published=False
    )
    still_published = ContentFileFactory.create_batch(
        1, run=eligible_run, published=True
    )
    ineligible_old_unpublished = ContentFileFactory.create_batch(
        2, run=ineligible_run, published=False
    )

    # Force updated_on values so this test is deterministic around the threshold.
    ContentFile.objects.filter(
        id__in=[f.id for f in old_unpublished + ineligible_old_unpublished]
    ).update(updated_on=old_cutoff)
    ContentFile.objects.filter(id__in=[f.id for f in recent_unpublished]).update(
        updated_on=recent_cutoff
    )

    result = cleanup_deleted_content_files()
    assert result == 3

    remaining_ids = set(ContentFile.objects.values_list("id", flat=True))
    for file in old_unpublished:
        assert file.id not in remaining_ids
    for file in recent_unpublished + still_published + ineligible_old_unpublished:
        assert file.id in remaining_ids


def test_cleanup_deleted_content_files_skips_republished_rows(mocker, settings):
    """
    If a content file picked up in the eligible id list gets republished
    before the chunked delete runs, it should be skipped instead of
    hard-deleted (the delete re-applies the eligibility filter).
    """
    settings.CONTENT_FILE_RETENTION_DAYS = 14
    settings.CONTENT_FILE_CLEANUP_CHUNK_SIZE = 10

    run = LearningResourceRunFactory.create(
        published=True, learning_resource__etl_source=ETLSource.mitxonline.value
    )
    old_cutoff = now_in_utc() - timedelta(days=15)
    doomed = ContentFileFactory.create_batch(2, run=run, published=False)
    survivor = ContentFileFactory.create(run=run, published=False)
    ContentFile.objects.filter(id__in=[f.id for f in [*doomed, survivor]]).update(
        updated_on=old_cutoff
    )

    # Wrap `list` inside the tasks module so that immediately after the
    # eligible-id list is materialized, we flip `survivor` to published=True
    # -- simulating a race between selection and the chunked delete. The
    # delete's re-applied eligibility filter should still spare it.
    real_list = list

    def racy_list(iterable):
        result = real_list(iterable)
        ContentFile.objects.filter(id=survivor.id).update(published=True)
        return result

    mocker.patch("learning_resources.tasks.list", side_effect=racy_list, create=True)

    deleted_count = cleanup_deleted_content_files()

    assert deleted_count == 2
    remaining_ids = set(ContentFile.objects.values_list("id", flat=True))
    assert survivor.id in remaining_ids
    for file in doomed:
        assert file.id not in remaining_ids


def test_cleanup_deleted_content_files_no_eligible_returns_zero(mocker, settings):
    """cleanup_deleted_content_files should no-op and return 0 when nothing is eligible."""
    settings.CONTENT_FILE_RETENTION_DAYS = 14
    settings.CONTENT_FILE_CLEANUP_CHUNK_SIZE = 2
    run = LearningResourceRunFactory.create(
        published=True, learning_resource__etl_source=ETLSource.mitxonline.value
    )
    ContentFileFactory.create_batch(2, run=run, published=True)

    mocker.patch("learning_resources.tasks.log.info")

    deleted_count = cleanup_deleted_content_files()

    assert deleted_count == 0


def test_cleanup_deleted_content_files_returns_error_on_unexpected_exception(mocker):
    """cleanup_deleted_content_files should return an error string for non-retry exceptions."""
    mocker.patch(
        "learning_resources.tasks.ContentFile.objects.filter",
        side_effect=RuntimeError("boom"),
    )

    result = cleanup_deleted_content_files()

    assert result == "cleanup_deleted_content_files threw an error"
