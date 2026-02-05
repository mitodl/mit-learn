"""ETL utils test"""

from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from learning_resources.constants import PlatformType
from learning_resources.etl.constants import ETLSource
from learning_resources.etl.edx_shared import (
    get_most_recent_course_archives,
    sync_edx_course_files,
)
from learning_resources.etl.utils import get_s3_prefix_for_source
from learning_resources.factories import (
    CourseFactory,
    LearningResourceFactory,
    LearningResourcePlatformFactory,
    LearningResourceRunFactory,
)

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    ("source", "platform"),
    [
        (ETLSource.mitxonline.name, PlatformType.mitxonline.name),
        (ETLSource.xpro.name, PlatformType.xpro.name),
        (ETLSource.mit_edx.name, PlatformType.edx.name),
        (ETLSource.oll.name, PlatformType.edx.name),
    ],
)
@pytest.mark.parametrize("published", [True, False])
def test_sync_edx_course_files(
    mock_course_archive_bucket,
    mocker,
    source,
    platform,
    published,
):  # pylint: disable=too-many-arguments,too-many-locals
    """Sync edx courses from a tarball stored in S3"""
    mock_load_content_files = mocker.patch(
        "learning_resources.etl.edx_shared.load_content_files",
        autospec=True,
        return_value=[],
    )
    mock_log = mocker.patch("learning_resources.etl.utils.log.exception")
    fake_data = '{"key": "data"}'
    mock_transform = mocker.patch(
        "learning_resources.etl.edx_shared.transform_content_files",
        return_value=fake_data,
    )
    bucket = mock_course_archive_bucket.bucket
    mocker.patch(
        "learning_resources.etl.edx_shared.get_bucket_by_name",
        return_value=mock_course_archive_bucket.bucket,
    )
    courses = LearningResourceFactory.create_batch(
        2,
        platform=LearningResourcePlatformFactory.create(code=platform),
        etl_source=source,
        is_course=True,
        published=True,
        create_runs=False,
    )
    keys = []
    s3_prefix = get_s3_prefix_for_source(source)
    for course in courses:
        runs = LearningResourceRunFactory.create_batch(
            2,
            learning_resource=course,
            published=published,
        )
        course.refresh_from_db()
        if published:
            assert course.best_run in runs
        keys.extend(
            [f"{s3_prefix}/{run.run_id}/foo.tar.gz" for run in runs]
            if source != ETLSource.oll.name
            else [f"{s3_prefix}/{run.run_id}_OLL.tar.gz" for run in runs]
        )
        for key in keys:
            with Path.open(
                Path("test_json/course-v1:MITxT+8.01.3x+3T2022.tar.gz"), "rb"
            ) as infile:
                bucket.put_object(
                    Key=key,
                    Body=infile.read(),
                    ACL="public-read",
                )
    sync_edx_course_files(source, [course.id for course in courses], keys)
    # Only best runs for published courses are processed, so 2 runs (one per course) not 4
    expected_calls = 2 if published else 0
    assert mock_transform.call_count == expected_calls
    assert mock_load_content_files.call_count == expected_calls
    if published:
        for course in courses:
            mock_load_content_files.assert_any_call(course.best_run, fake_data)
    mock_log.assert_not_called()


def test_sync_edx_course_files_matching_checksum(mocker, mock_course_archive_bucket):
    """If the checksum matches, the contentfile loading should be skipped but other runs still deindexed"""

    run = LearningResourceFactory.create(
        is_course=True, create_runs=True, etl_source=ETLSource.mitxonline.name
    ).best_run
    run.learning_resource.runs.exclude(id=run.id).first()
    run.checksum = "123"
    run.save()
    mocker.patch(
        "learning_resources.etl.edx_shared.calc_checksum", return_value=run.checksum
    )
    mock_index = mocker.patch(
        "learning_resources_search.plugins.tasks.index_run_content_files"
    )
    mock_log = mocker.patch("learning_resources.etl.edx_shared.log.info")
    mock_load = mocker.patch("learning_resources.etl.edx_shared.load_content_files")

    key = (
        f"{get_s3_prefix_for_source(ETLSource.mitxonline.name)}/{run.run_id}/foo.tar.gz"
    )
    bucket = mock_course_archive_bucket.bucket
    mocker.patch(
        "learning_resources.etl.edx_shared.get_bucket_by_name",
        return_value=bucket,
    )
    bucket.put_object(
        Key=key,
        Body=b"".join([b"x" for _ in range(100)]),
        ACL="public-read",
    )
    sync_edx_course_files("mitxonline", [run.learning_resource.id], [key])
    mock_log.assert_any_call("Checksums match for %s, skipping load", key)
    mock_load.assert_not_called()
    mock_index.assert_not_called()


@pytest.mark.parametrize("source", [ETLSource.mitxonline.value, ETLSource.xpro.value])
def test_sync_edx_course_files_invalid_tarfile(
    mock_course_archive_bucket, mocker, source
):
    """An invalid mitxonline tarball should be skipped"""
    course = LearningResourceFactory.create(
        etl_source=source,
        published=True,
        create_runs=True,
    )
    run = course.best_run
    key = f"{get_s3_prefix_for_source(source)}/{run.run_id}/foo.tar.gz"
    bucket = mock_course_archive_bucket.bucket
    bucket.put_object(
        Key=key,
        Body=b"".join([b"x" for _ in range(100)]),
        ACL="public-read",
    )
    mocker.patch(
        "learning_resources.etl.edx_shared.get_bucket_by_name",
        return_value=bucket,
    )
    mock_log = mocker.patch("learning_resources.etl.edx_shared.log.exception")

    sync_edx_course_files(source, [run.learning_resource.id], [key])
    mock_log.assert_called_once()
    assert mock_log.call_args[0][0].startswith("Error reading tar file") is True


@pytest.mark.parametrize("source", [ETLSource.mitxonline.value, ETLSource.xpro.value])
def test_sync_edx_course_files_empty_bucket(mock_course_archive_bucket, mocker, source):
    """If the mitxonline bucket has no tarballs matching a filename, it should be skipped"""
    run = LearningResourceRunFactory.create(
        learning_resource=CourseFactory.create(etl_source=source).learning_resource,
    )
    key = f"{get_s3_prefix_for_source(source)}/some_other_course/foo.tar.gz"
    bucket = mock_course_archive_bucket.bucket
    with Path.open(
        Path("test_json/course-v1:MITxT+8.01.3x+3T2022.tar.gz"), "rb"
    ) as infile:
        bucket.put_object(
            Key=key,
            Body=infile.read(),
            ACL="public-read",
        )
    mock_load_content_files = mocker.patch(
        "learning_resources.etl.edx_shared.load_content_files",
        autospec=True,
        return_value=[],
    )
    mocker.patch(
        "learning_resources.etl.edx_shared.get_bucket_by_name",
        return_value=bucket,
    )
    sync_edx_course_files(source, [run.learning_resource.id], [key])
    mock_load_content_files.assert_not_called()


@pytest.mark.parametrize("source", [ETLSource.mitxonline.value, ETLSource.xpro.value])
def test_sync_edx_course_files_error(mock_course_archive_bucket, mocker, source):
    """Exceptions raised during sync_mitxonline_course_files should be logged"""
    course = LearningResourceFactory.create(
        etl_source=source,
        published=True,
        create_runs=True,
    )
    run = course.best_run
    key = f"{get_s3_prefix_for_source(source)}/{run.run_id}/foo.tar.gz"
    bucket = mock_course_archive_bucket.bucket
    with Path.open(
        Path("test_json/course-v1:MITxT+8.01.3x+3T2022.tar.gz"), "rb"
    ) as infile:
        bucket.put_object(
            Key=key,
            Body=infile.read(),
            ACL="public-read",
        )
    mocker.patch(
        "learning_resources.etl.edx_shared.get_bucket_by_name",
        return_value=bucket,
    )
    mock_load_content_files = mocker.patch(
        "learning_resources.etl.edx_shared.load_content_files",
        autospec=True,
        side_effect=Exception,
    )
    fake_data = '{"key": "data"}'
    mock_log = mocker.patch("learning_resources.etl.edx_shared.log.exception")
    mock_transform = mocker.patch(
        "learning_resources.etl.edx_shared.transform_content_files",
        return_value=fake_data,
    )
    sync_edx_course_files(source, [run.learning_resource.id], [key])
    assert mock_transform.call_count == 1
    assert str(mock_transform.call_args[0][0]).endswith("foo.tar.gz") is True
    mock_load_content_files.assert_called_once_with(run, fake_data)
    assert mock_log.call_args[0][0].startswith("Error ingesting OLX content data for ")


@pytest.mark.parametrize("source", [ETLSource.mitxonline.value, ETLSource.xpro.value])
def test_sync_edx_course_files_no_matching_run(
    mock_course_archive_bucket, mocker, source
):
    """If no run matches the run_id from the tarball, it should be skipped"""
    course = LearningResourceFactory.create(
        etl_source=source,
        published=True,
        create_runs=True,
    )
    run = course.best_run
    # Use a different run_id in the key than what exists in the database
    key = f"{get_s3_prefix_for_source(source)}/courses/non-existent-run-id/foo.tar.gz"
    bucket = mock_course_archive_bucket.bucket
    with Path.open(
        Path("test_json/course-v1:MITxT+8.01.3x+3T2022.tar.gz"), "rb"
    ) as infile:
        bucket.put_object(
            Key=key,
            Body=infile.read(),
            ACL="public-read",
        )
    mocker.patch(
        "learning_resources.etl.edx_shared.get_bucket_by_name",
        return_value=bucket,
    )
    mock_load_content_files = mocker.patch(
        "learning_resources.etl.edx_shared.load_content_files",
        autospec=True,
        return_value=[],
    )
    mock_log = mocker.patch("learning_resources.etl.edx_shared.log.info")

    sync_edx_course_files(source, [run.learning_resource.id], [key])

    mock_load_content_files.assert_not_called()
    mock_log.assert_any_call("No runs found for %s, skipping", key)


@pytest.mark.parametrize("source", [ETLSource.mitxonline.value, ETLSource.xpro.value])
def test_sync_edx_course_files_test_mode_all_runs_processed(
    mock_course_archive_bucket, mocker, source
):
    """For test mode courses, all runs should be processed (not just the best run)"""
    course = LearningResourceFactory.create(
        etl_source=source,
        published=False,
        test_mode=True,
        create_runs=False,
    )
    # Create multiple runs for this course
    runs = LearningResourceRunFactory.create_batch(
        3,
        learning_resource=course,
        published=False,
    )
    course.refresh_from_db()

    # Create keys for all runs
    keys = [
        f"{get_s3_prefix_for_source(source)}/courses/{run.run_id}/foo.tar.gz"
        for run in runs
    ]

    bucket = mock_course_archive_bucket.bucket

    # Put all archive files in S3
    for key in keys:
        with Path.open(
            Path("test_json/course-v1:MITxT+8.01.3x+3T2022.tar.gz"), "rb"
        ) as infile:
            bucket.put_object(
                Key=key,
                Body=infile.read(),
                ACL="public-read",
            )

    mocker.patch(
        "learning_resources.etl.edx_shared.get_bucket_by_name",
        return_value=bucket,
    )
    fake_data = '{"key": "data"}'
    mock_transform = mocker.patch(
        "learning_resources.etl.edx_shared.transform_content_files",
        return_value=fake_data,
    )
    mock_load_content_files = mocker.patch(
        "learning_resources.etl.edx_shared.load_content_files",
        autospec=True,
        return_value=[],
    )

    sync_edx_course_files(source, [course.id], keys)

    # All 3 runs should be processed, not just the best run
    assert mock_transform.call_count == 3
    assert mock_load_content_files.call_count == 3

    # Verify each run was processed
    for run in runs:
        mock_load_content_files.assert_any_call(run, fake_data)


@pytest.mark.parametrize("source", [ETLSource.mit_edx.value, ETLSource.xpro.value])
def test_get_most_recent_course_archives(mocker, mock_course_archive_bucket, source):
    """get_most_recent_course_archives should return expected keys"""
    from types import SimpleNamespace
    from unittest.mock import MagicMock

    base_key = f"{get_s3_prefix_for_source(source)}/my-course/"

    # Create mock S3 objects with last_modified attributes
    mock_archives = [
        SimpleNamespace(
            key=f"{base_key}{year}.tar.gz",
            last_modified=datetime(year, 1, 1, 12, 0, 0, tzinfo=ZoneInfo("UTC")),
        )
        for year in [2021, 2022, 2023]
    ]

    # Create a mock bucket with mocked objects.filter
    mock_bucket = MagicMock()
    mock_bucket.objects.filter.return_value = mock_archives

    mock_get_bucket = mocker.patch(
        "learning_resources.etl.edx_shared.get_bucket_by_name",
        return_value=mock_bucket,
    )
    assert get_most_recent_course_archives(source) == [f"{base_key}2023.tar.gz"]
    mock_get_bucket.assert_called_once_with(mocker.ANY)


@pytest.mark.parametrize("source", [ETLSource.mit_edx.value, ETLSource.xpro.value])
def test_get_most_recent_course_archives_empty(
    settings, mocker, mock_course_archive_bucket, source
):
    """Empty list should be returned if no recent tar archives are found"""
    from unittest.mock import MagicMock

    # Create a mock bucket with no objects
    mock_bucket = MagicMock()
    mock_bucket.name = settings.COURSE_ARCHIVE_BUCKET_NAME
    mock_bucket.objects.filter.return_value = []

    mock_get_bucket = mocker.patch(
        "learning_resources.etl.edx_shared.get_bucket_by_name",
        return_value=mock_bucket,
    )
    assert get_most_recent_course_archives(source) == []
    mock_get_bucket.assert_called_once_with(settings.COURSE_ARCHIVE_BUCKET_NAME)


@pytest.mark.parametrize("source", [ETLSource.mit_edx.value, ETLSource.xpro.value])
def test_get_most_recent_course_archives_no_bucket(settings, mocker, source):
    """Empty list should be returned and a warning logged if no bucket is found"""
    mocker.patch(
        "learning_resources.etl.edx_shared.get_bucket_by_name",
        return_value=None,
    )
    mock_warning = mocker.patch("learning_resources.etl.edx_shared.log.warning")
    assert get_most_recent_course_archives(source) == []
    mock_warning.assert_called_once_with("No S3 bucket for platform %s", source)


@pytest.mark.parametrize(
    ("etl_source", "platform", "archive_filename", "expected_run_id"),
    [
        (
            ETLSource.mitxonline.name,
            PlatformType.mitxonline.name,
            "/mitxonline/courses/course-v1:MITxT+8.01.3x+3T2022/abcdefghijklmnop.tar.gz",
            "course-v1:MITxT+8.01.3x+3T2022",
        ),
        (
            ETLSource.xpro.name,
            PlatformType.xpro.name,
            "/xpro/courses/course-v1:xPRO+SysEngxB1+R12/abcdefghijklmnop.tar.gz",
            "course-v1:xPRO+SysEngxB1+R12",
        ),
        (
            ETLSource.mit_edx.name,
            PlatformType.edx.name,
            "/edx/courses/MITx-12.345x-3T2022/abcdefghijklmnop.tar.gz",
            "MITx-12.345x-3T2022",
        ),
        (
            ETLSource.oll.name,
            PlatformType.edx.name,
            "/oll/courses/course-v1:OLL+ABC123+R1_OLL.tar.gz",
            "course-v1:OLL+ABC123+R1",
        ),
    ],
)
def test_run_for_edx_archive(etl_source, platform, archive_filename, expected_run_id):
    """Test run_for_edx_archive returns the correct run for various platforms"""
    from learning_resources.etl.edx_shared import run_for_edx_archive

    course = LearningResourceFactory.create(
        platform=LearningResourcePlatformFactory.create(code=platform),
        etl_source=etl_source,
        published=True,
        create_runs=False,
    )
    run = LearningResourceRunFactory.create(
        learning_resource=course,
        published=True,
        run_id=expected_run_id,
    )
    course.refresh_from_db()

    result = run_for_edx_archive(etl_source, archive_filename)
    assert result == run


@pytest.mark.parametrize(
    "etl_source",
    [ETLSource.mitxonline.name, ETLSource.xpro.name, ETLSource.mit_edx.name],
)
def test_run_for_edx_archive_no_match(etl_source):
    """Test run_for_edx_archive returns None when no matching run is found"""
    from learning_resources.etl.edx_shared import run_for_edx_archive

    archive_filename = (
        f"{etl_source}/courses/non-existent-course/abcdefghijklmnop.tar.gz"
    )
    result = run_for_edx_archive(etl_source, archive_filename)
    assert result is None


@pytest.mark.parametrize(
    "etl_source",
    [ETLSource.mitxonline.name, ETLSource.xpro.name],
)
def test_run_for_edx_archive_with_id_filter(etl_source):
    """Test run_for_edx_archive filters by ids when provided"""
    from learning_resources.etl.edx_shared import run_for_edx_archive

    platform = (
        PlatformType.mitxonline.name
        if etl_source == ETLSource.mitxonline.name
        else PlatformType.xpro.name
    )

    # Create two courses with runs
    course1 = LearningResourceFactory.create(
        platform=LearningResourcePlatformFactory.create(code=platform),
        etl_source=etl_source,
        published=True,
        create_runs=False,
    )
    run1 = LearningResourceRunFactory.create(
        learning_resource=course1,
        published=True,
        run_id="course-v1:Test+Course1+R1",
    )

    course2 = LearningResourceFactory.create(
        platform=LearningResourcePlatformFactory.create(code=platform),
        etl_source=etl_source,
        published=True,
        create_runs=False,
    )
    LearningResourceRunFactory.create(
        learning_resource=course2,
        published=True,
        run_id="course-v1:Test+Course2+R1",
    )

    # Only search for course1's id
    result = run_for_edx_archive(
        etl_source,
        f"{etl_source}/courses/course-v1:Test+Course1+R1/abcdefghijklmnop.tar.gz",
        course_id=course1.readable_id,
    )
    assert result == run1


@pytest.mark.parametrize(
    "etl_source",
    [ETLSource.mitxonline.name, ETLSource.xpro.name],
)
def test_run_for_edx_archive_unpublished_course(etl_source):
    """Test run_for_edx_archive doesn't return runs for unpublished courses (unless test_mode)"""
    from learning_resources.etl.edx_shared import run_for_edx_archive

    platform = (
        PlatformType.mitxonline.name
        if etl_source == ETLSource.mitxonline.name
        else PlatformType.xpro.name
    )

    # Create unpublished course with published run
    course = LearningResourceFactory.create(
        platform=LearningResourcePlatformFactory.create(code=platform),
        etl_source=etl_source,
        published=False,
        test_mode=False,
        create_runs=False,
    )
    LearningResourceRunFactory.create(
        learning_resource=course,
        published=True,
        run_id="course-v1:Test+Course+R1",
    )

    result = run_for_edx_archive(
        etl_source,
        f"{etl_source}/courses/course-v1:Test+Course+R1/abcdefghijklmnop.tar.gz",
    )
    assert result is None


@pytest.mark.parametrize(
    "etl_source",
    [ETLSource.mitxonline.name, ETLSource.xpro.name],
)
def test_run_for_edx_archive_test_mode(etl_source):
    """Test run_for_edx_archive returns runs for test_mode courses even if unpublished"""
    from learning_resources.etl.edx_shared import run_for_edx_archive

    platform = (
        PlatformType.mitxonline.name
        if etl_source == ETLSource.mitxonline.name
        else PlatformType.xpro.name
    )

    # Create test_mode course
    course = LearningResourceFactory.create(
        platform=LearningResourcePlatformFactory.create(code=platform),
        etl_source=etl_source,
        published=False,
        test_mode=True,
        create_runs=False,
    )
    run = LearningResourceRunFactory.create(
        learning_resource=course,
        published=False,
        run_id="course-v1:Test+Course+R1",
    )

    result = run_for_edx_archive(
        etl_source,
        f"{etl_source}/courses/course-v1:Test+Course+R1/abcdefghijklmnop.tar.gz",
    )
    assert result == run


@pytest.mark.parametrize(
    ("etl_source", "platform"),
    [
        (ETLSource.mitxonline.name, PlatformType.mitxonline.name),
        (ETLSource.xpro.name, PlatformType.xpro.name),
        (ETLSource.mit_edx.name, PlatformType.edx.name),
    ],
)
def test_sync_edx_archive_success(
    mocker, mock_course_archive_bucket, etl_source, platform
):
    """Test sync_edx_archive successfully processes a course archive"""
    from learning_resources.etl.edx_shared import sync_edx_archive

    # Create a course with a run
    course = LearningResourceFactory.create(
        platform=LearningResourcePlatformFactory.create(code=platform),
        etl_source=etl_source,
        published=True,
        create_runs=False,
    )
    run = LearningResourceRunFactory.create(
        learning_resource=course,
        published=True,
        run_id="course-v1:Test+Course+R1",
    )
    course.refresh_from_db()

    # Mock the bucket and file operations
    bucket = mock_course_archive_bucket.bucket
    s3_key = "mitxonline/courses/course-v1:Test+Course+R1/abcdefghijklmnop.tar.gz"

    with Path.open(
        Path("test_json/course-v1:MITxT+8.01.3x+3T2022.tar.gz"), "rb"
    ) as infile:
        bucket.put_object(Key=s3_key, Body=infile.read(), ACL="public-read")

    mocker.patch(
        "learning_resources.etl.edx_shared.get_bucket_by_name",
        return_value=bucket,
    )
    mock_transform = mocker.patch(
        "learning_resources.etl.edx_shared.transform_content_files",
        return_value='{"key": "data"}',
    )
    mock_load = mocker.patch(
        "learning_resources.etl.edx_shared.load_content_files", return_value=[]
    )

    sync_edx_archive(etl_source, s3_key, overwrite=False)

    mock_transform.assert_called_once()
    mock_load.assert_called_once_with(run, '{"key": "data"}')
    run.refresh_from_db()
    assert run.checksum is not None


@pytest.mark.parametrize("etl_source", [ETLSource.mitxonline.name, ETLSource.xpro.name])
def test_sync_edx_archive_no_run_found(mocker, mock_course_archive_bucket, etl_source):
    """Test sync_edx_archive logs warning and returns when no matching run is found"""
    from learning_resources.etl.edx_shared import sync_edx_archive

    bucket = mock_course_archive_bucket.bucket
    s3_key = f"{etl_source}/courses/non-existent-course/abcdefghijklmnop.tar.gz"

    with Path.open(
        Path("test_json/course-v1:MITxT+8.01.3x+3T2022.tar.gz"), "rb"
    ) as infile:
        bucket.put_object(Key=s3_key, Body=infile.read(), ACL="public-read")

    mocker.patch(
        "learning_resources.etl.edx_shared.get_bucket_by_name",
        return_value=bucket,
    )
    mock_log = mocker.patch("learning_resources.etl.edx_shared.log.warning")
    mock_process = mocker.patch(
        "learning_resources.etl.edx_shared.process_course_archive"
    )

    sync_edx_archive(etl_source, s3_key, overwrite=False)

    mock_log.assert_called_once_with(
        "No published/test_mode %s run found for archive %s", etl_source, s3_key
    )
    mock_process.assert_not_called()


@pytest.mark.parametrize("etl_source", [ETLSource.mitxonline.name, ETLSource.xpro.name])
def test_sync_edx_archive_not_best_run(mocker, mock_course_archive_bucket, etl_source):
    """Test sync_edx_archive skips processing when run is not the best run"""
    from learning_resources.etl.edx_shared import sync_edx_archive

    platform = (
        PlatformType.mitxonline.name
        if etl_source == ETLSource.mitxonline.name
        else PlatformType.xpro.name
    )

    # Create a course with multiple runs
    course = LearningResourceFactory.create(
        platform=LearningResourcePlatformFactory.create(code=platform),
        etl_source=etl_source,
        published=True,
        create_runs=False,
    )
    # Create older run (not best) with earlier start date
    from datetime import UTC, datetime

    old_run = LearningResourceRunFactory.create(
        learning_resource=course,
        published=True,
        run_id="course-v1:Test+Course+R1",
        start_date=datetime(2022, 1, 1, tzinfo=UTC),
    )
    # Create newer run (will be best) with later start date
    LearningResourceRunFactory.create(
        learning_resource=course,
        published=True,
        run_id="course-v1:Test+Course+R2",
        start_date=datetime(2023, 1, 1, tzinfo=UTC),
    )
    course.refresh_from_db()

    # Verify the newer run is the best run
    assert course.best_run.run_id == "course-v1:Test+Course+R2"

    # Archive is for the old run, not the best run
    bucket = mock_course_archive_bucket.bucket
    s3_key = "20220101/courses/course-v1:Test+Course+R1/abcdefghijklmnop.tar.gz"

    with Path.open(
        Path("test_json/course-v1:MITxT+8.01.3x+3T2022.tar.gz"), "rb"
    ) as infile:
        bucket.put_object(Key=s3_key, Body=infile.read(), ACL="public-read")

    mocker.patch(
        "learning_resources.etl.edx_shared.get_bucket_by_name",
        return_value=bucket,
    )
    mock_process = mocker.patch(
        "learning_resources.etl.edx_shared.process_course_archive"
    )
    mock_log = mocker.patch("learning_resources.etl.edx_shared.log.warning")

    sync_edx_archive(etl_source, s3_key, overwrite=False)

    # Should log warning and not process
    assert mock_log.called
    assert "not the best run" in mock_log.call_args[0][0]
    assert old_run.run_id in mock_log.call_args[0][1]
    mock_process.assert_not_called()


@pytest.mark.parametrize("etl_source", [ETLSource.mitxonline.name, ETLSource.xpro.name])
def test_sync_edx_archive_test_mode_all_runs(
    mocker, mock_course_archive_bucket, etl_source
):
    """Test sync_edx_archive processes any run (not just best) for test_mode courses"""
    from learning_resources.etl.edx_shared import sync_edx_archive

    platform = (
        PlatformType.mitxonline.name
        if etl_source == ETLSource.mitxonline.name
        else PlatformType.xpro.name
    )

    # Create test_mode course with multiple runs
    course = LearningResourceFactory.create(
        platform=LearningResourcePlatformFactory.create(code=platform),
        etl_source=etl_source,
        published=False,
        test_mode=True,
        create_runs=False,
    )
    old_run = LearningResourceRunFactory.create(
        learning_resource=course,
        published=False,
        run_id="course-v1:Test+Course+R1",
    )
    LearningResourceRunFactory.create(
        learning_resource=course,
        published=False,
        run_id="course-v1:Test+Course+R2",
    )

    bucket = mock_course_archive_bucket.bucket
    s3_key = "20220101/courses/course-v1:Test+Course+R1/abcdefghijklmnop.tar.gz"

    with Path.open(
        Path("test_json/course-v1:MITxT+8.01.3x+3T2022.tar.gz"), "rb"
    ) as infile:
        bucket.put_object(Key=s3_key, Body=infile.read(), ACL="public-read")

    mocker.patch(
        "learning_resources.etl.edx_shared.get_bucket_by_name",
        return_value=bucket,
    )
    mock_transform = mocker.patch(
        "learning_resources.etl.edx_shared.transform_content_files",
        return_value='{"key": "data"}',
    )
    mock_load = mocker.patch(
        "learning_resources.etl.edx_shared.load_content_files", return_value=[]
    )

    # Should process even though it's not the best run, because test_mode=True
    sync_edx_archive(etl_source, s3_key, overwrite=False)

    mock_transform.assert_called_once()
    mock_load.assert_called_once_with(old_run, '{"key": "data"}')


@pytest.mark.parametrize("etl_source", [ETLSource.mitxonline.name, ETLSource.xpro.name])
def test_sync_edx_archive_with_overwrite(
    mocker, mock_course_archive_bucket, etl_source
):
    """Test sync_edx_archive processes with overwrite=True"""
    from learning_resources.etl.edx_shared import sync_edx_archive

    platform = (
        PlatformType.mitxonline.name
        if etl_source == ETLSource.mitxonline.name
        else PlatformType.xpro.name
    )

    course = LearningResourceFactory.create(
        platform=LearningResourcePlatformFactory.create(code=platform),
        etl_source=etl_source,
        published=True,
        create_runs=False,
    )
    run = LearningResourceRunFactory.create(
        learning_resource=course,
        published=True,
        run_id="course-v1:Test+Course+R1",
        checksum="old_checksum",
    )
    course.refresh_from_db()

    bucket = mock_course_archive_bucket.bucket
    s3_key = "20220101/courses/course-v1:Test+Course+R1/abcdefghijklmnop.tar.gz"

    with Path.open(
        Path("test_json/course-v1:MITxT+8.01.3x+3T2022.tar.gz"), "rb"
    ) as infile:
        bucket.put_object(Key=s3_key, Body=infile.read(), ACL="public-read")

    mocker.patch(
        "learning_resources.etl.edx_shared.get_bucket_by_name",
        return_value=bucket,
    )
    mock_transform = mocker.patch(
        "learning_resources.etl.edx_shared.transform_content_files",
        return_value='{"key": "data"}',
    )
    mock_load = mocker.patch(
        "learning_resources.etl.edx_shared.load_content_files", return_value=[]
    )

    sync_edx_archive(etl_source, s3_key, overwrite=True)

    # Should process even if checksum matches, because overwrite=True
    mock_transform.assert_called_once()
    mock_load.assert_called_once()
    run.refresh_from_db()
    assert run.checksum != "old_checksum"
