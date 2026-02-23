"""Tests for ETL loaders"""

from datetime import timedelta
from decimal import Decimal
from pathlib import Path

# pylint: disable=redefined-outer-name,too-many-locals,too-many-lines
from types import SimpleNamespace

import pytest
from django.forms.models import model_to_dict

from learning_resources.constants import (
    CURRENCY_USD,
    Availability,
    LearningResourceDelivery,
    LearningResourceRelationTypes,
    LearningResourceType,
    OfferedBy,
    PlatformType,
    RunStatus,
)
from learning_resources.etl import loaders
from learning_resources.etl.constants import (
    CourseLoaderConfig,
    ETLSource,
    ProgramLoaderConfig,
)
from learning_resources.etl.edx_shared import sync_edx_course_files
from learning_resources.etl.exceptions import ExtractException
from learning_resources.etl.loaders import (
    calculate_completeness,
    load_content_file,
    load_content_files,
    load_course,
    load_courses,
    load_image,
    load_instructors,
    load_offered_by,
    load_playlist,
    load_playlists,
    load_podcast,
    load_podcast_episode,
    load_podcasts,
    load_problem_file,
    load_problem_files,
    load_program,
    load_programs,
    load_run,
    load_run_dependent_values,
    load_topics,
    load_video,
    load_video_channels,
    load_videos,
)
from learning_resources.etl.utils import get_s3_prefix_for_source
from learning_resources.etl.xpro import _parse_datetime
from learning_resources.factories import (
    ArticleFactory,
    ContentFileFactory,
    CourseFactory,
    LearningResourceContentTagFactory,
    LearningResourceDepartmentFactory,
    LearningResourceFactory,
    LearningResourceInstructorFactory,
    LearningResourceOfferorFactory,
    LearningResourcePlatformFactory,
    LearningResourcePriceFactory,
    LearningResourceRunFactory,
    LearningResourceTopicFactory,
    PodcastEpisodeFactory,
    PodcastFactory,
    ProgramFactory,
    VideoChannelFactory,
    VideoFactory,
    VideoPlaylistFactory,
)
from learning_resources.models import (
    ContentFile,
    Course,
    LearningResource,
    LearningResourceImage,
    LearningResourceOfferor,
    LearningResourceRun,
    PodcastEpisode,
    Program,
    TutorProblemFile,
    Video,
    VideoChannel,
    VideoPlaylist,
)
from main.utils import now_in_utc

pytestmark = pytest.mark.django_db

non_transformable_attributes = (
    "id",
    "platform",
    "departments",
    "content_tags",
    "resource_tags",
    "resources",
    "delivery",
    "resource_prices",
)


@pytest.fixture(autouse=True)
def youtube_video_platform():
    """Fixture for a youtube video platform"""
    return LearningResourcePlatformFactory.create(code=PlatformType.youtube.name)


@pytest.fixture(autouse=True)
def climate_platform():
    """Fixture for a youtube video platform"""
    return LearningResourcePlatformFactory.create(code=PlatformType.climate.name)


@pytest.fixture(autouse=True)
def mock_blocklist(mocker):
    """Mock the load_course_blocklist function"""
    return mocker.patch(
        "learning_resources.etl.loaders.load_course_blocklist", return_value=[]
    )


@pytest.fixture(autouse=True)
def mock_duplicates(mocker):
    """Mock the load_course_duplicates function"""
    return mocker.patch(
        "learning_resources.etl.loaders.load_course_duplicates", return_value=[]
    )


@pytest.fixture
def mock_get_similar_topics_qdrant(mocker):
    mocker.patch(
        "learning_resources_search.plugins.get_similar_topics_qdrant",
        return_value=["topic1", "topic2"],
    )


@pytest.fixture(autouse=True)
def mock_upsert_tasks(mocker):
    """Mock out the upsert task helpers"""
    return SimpleNamespace(
        upsert_learning_resource=mocker.patch(
            "learning_resources_search.tasks.upsert_learning_resource",
        ),
        upsert_learning_resource_immutable_signature=mocker.patch(
            "learning_resources_search.tasks.upsert_learning_resource.si",
        ),
        deindex_learning_resource=mocker.patch(
            "learning_resources_search.tasks.deindex_document"
        ),
        deindex_learning_resource_immutable_signature=mocker.patch(
            "learning_resources_search.tasks.deindex_document.si"
        ),
        batch_deindex_resources=mocker.patch(
            "learning_resources_search.tasks.bulk_deindex_learning_resources.si"
        ),
    )


@pytest.mark.parametrize("published", [False, True])
@pytest.mark.parametrize("test_mode", [False, True])
@pytest.mark.parametrize("newly_created", [False, True])
def test_update_index_test_mode_behavior(
    mocker,
    published,
    test_mode,
    newly_created,
):
    """Test update_index does not remove test_mode content files from index"""
    resource_unpublished_actions = mocker.patch(
        "learning_resources.etl.loaders.resource_unpublished_actions"
    )
    lr = LearningResourceFactory.create(published=published, test_mode=test_mode)

    loaders.update_index(lr, newly_created)
    if test_mode:
        resource_unpublished_actions.assert_not_called()
    elif not published and not newly_created:
        resource_unpublished_actions.assert_called_once()


@pytest.fixture
def learning_resource_offeror():
    """Return a LearningResourceOfferer"""
    return LearningResourceOfferorFactory.create()


@pytest.mark.parametrize("program_exists", [True, False])
@pytest.mark.parametrize("is_published", [True, False])
@pytest.mark.parametrize("courses_exist", [True, False])
@pytest.mark.parametrize("has_retired_course", [True, False])
@pytest.mark.parametrize("delivery", [LearningResourceDelivery.in_person.name, None])
def test_load_program(  # noqa: PLR0913
    mock_upsert_tasks,
    program_exists,
    is_published,
    courses_exist,
    has_retired_course,
    delivery,
):
    """Test that load_program loads the program"""
    platform = LearningResourcePlatformFactory.create()

    program = (
        ProgramFactory.create(courses=[], platform=platform.code)
        if program_exists
        else ProgramFactory.build(courses=[], platform=platform.code)
    )

    LearningResourcePlatformFactory.create(code=platform.code)

    if program_exists:
        learning_resource = program.learning_resource
        learning_resource.is_published = is_published
        learning_resource.platform = platform
        learning_resource.runs.set([])
        learning_resource.save()

    courses = (
        CourseFactory.create_batch(2, platform=platform.code)
        if courses_exist
        else CourseFactory.build_batch(2, platform=platform.code)
    )

    before_course_count = len(courses) if courses_exist else 0
    after_course_count = len(courses)

    if program_exists and has_retired_course:
        course = CourseFactory.create(platform=platform.code)
        before_course_count += 1
        after_course_count += 1
        program.learning_resource.resources.set(
            [course.learning_resource],
            through_defaults={
                "relation_type": LearningResourceRelationTypes.PROGRAM_COURSES.value
            },
        )
        assert program.learning_resource.children.count() == 1

    assert Program.objects.count() == (1 if program_exists else 0)
    assert Course.objects.count() == before_course_count

    run_data = {
        "run_id": program.learning_resource.readable_id,
        "enrollment_start": "2017-01-01T00:00:00Z",
        "start_date": "2017-01-20T00:00:00Z",
        "end_date": "2017-06-20T00:00:00Z",
    }

    delivery_data = {"delivery": [delivery]} if delivery else {}
    result = load_program(
        {
            "platform": platform.code,
            "readable_id": program.learning_resource.readable_id,
            "professional": False,
            "title": program.learning_resource.title,
            "url": program.learning_resource.url,
            "image": {"url": program.learning_resource.image.url},
            "published": is_published,
            "runs": [run_data],
            "availability": program.learning_resource.availability,
            "courses": [
                {
                    "readable_id": course.learning_resource.readable_id,
                    "platform": platform.code,
                    "availability": course.learning_resource.availability,
                }
                for course in courses
            ],
            **delivery_data,
        },
        [],
        [],
    )

    assert Program.objects.count() == 1
    assert Course.objects.count() == after_course_count

    # assert we got a program back and that each course is in a program
    assert isinstance(result, LearningResource)
    assert result.delivery == (
        [delivery if delivery is not None else LearningResourceDelivery.online.name]
    )
    assert result.professional is False
    assert result.children.count() == len(courses)
    assert result.program.courses.count() == len(courses)
    assert result.runs.filter(published=True).count() == 1

    assert result.runs.filter(published=True).first().start_date == _parse_datetime(
        run_data["start_date"]
    )

    for relationship, data in zip(
        sorted(
            result.program.learning_resource.children.all(),
            key=lambda item: item.child.readable_id,
        ),
        sorted(courses, key=lambda course: course.learning_resource.readable_id),
    ):
        assert isinstance(relationship.child, LearningResource)
        assert relationship.child.readable_id == data.learning_resource.readable_id

    if program_exists and not is_published:
        mock_upsert_tasks.deindex_learning_resource_immutable_signature.assert_called_with(
            result.id, result.resource_type
        )
    elif is_published:
        mock_upsert_tasks.upsert_learning_resource_immutable_signature.assert_called_with(
            result.id
        )
    else:
        mock_upsert_tasks.upsert_learning_resource_immutable_signature.assert_not_called()


@pytest.mark.django_db
def test_load_run_sets_test_resource_run_to_published(mocker):
    """
    Test that load_run sets the test_mode run to published
    """

    mock_qs = mocker.patch.object(
        loaders.LearningResourceRun.objects, "filter", autospec=True
    )
    mock_qs.return_value.exists.return_value = True

    test_mode_learning_resource = LearningResourceFactory.create(test_mode=True)

    test_mode_run_id = "test_run_id"
    test_mode_run_data = {"run_id": test_mode_run_id, "published": False}

    LearningResourceRunFactory.create(
        learning_resource=test_mode_learning_resource,
        run_id=test_mode_run_id,
        published=False,
    )

    result = loaders.load_run(test_mode_learning_resource, test_mode_run_data)
    assert result.published
    regular_learning_resource = LearningResourceFactory.create(test_mode=False)
    regular_run_id = "test_run_id"
    regular_run_data = {"run_id": regular_run_id, "published": False}
    LearningResourceRunFactory.create(
        learning_resource=regular_learning_resource,
        run_id=regular_run_id,
        published=False,
    )

    result = loaders.load_run(regular_learning_resource, regular_run_data)
    assert not result.published


def test_load_program_bad_platform(mocker):
    """A bad platform should log an exception and not create the program"""
    mock_log = mocker.patch("learning_resources.etl.loaders.log.exception")
    bad_platform = "bad_platform"
    props = {
        "readable_id": "abc123",
        "platform": bad_platform,
        "professional": False,
        "title": "program title",
        "image": {"url": "https://www.test.edu/image.jpg"},
        "description": "description",
        "url": "https://test.edu",
        "published": True,
        "courses": [],
    }
    result = load_program(props, [], [], config=ProgramLoaderConfig(prune=True))
    assert result is None
    mock_log.assert_called_once_with(
        "Platform %s is null or not in database: %s", bad_platform, "abc123"
    )


@pytest.mark.parametrize("course_exists", [True, False])
@pytest.mark.parametrize("is_published", [True, False])
@pytest.mark.parametrize("is_run_published", [True, False])
@pytest.mark.parametrize("blocklisted", [False, True])
@pytest.mark.parametrize("delivery", [LearningResourceDelivery.hybrid.name, None])
@pytest.mark.parametrize("has_upcoming_run", [True, False])
@pytest.mark.parametrize("has_departments", [True, False])
def test_load_course(  # noqa: PLR0913, PLR0912, PLR0915
    mock_upsert_tasks,
    course_exists,
    is_published,
    is_run_published,
    blocklisted,
    delivery,
    has_upcoming_run,
    has_departments,
):
    """Test that load_course loads the course"""
    platform = LearningResourcePlatformFactory.create()

    course = (
        CourseFactory.create(learning_resource__runs=[], platform=platform.code)
        if course_exists
        else CourseFactory.build(learning_resource__runs=[], platform=platform.code)
    )

    learning_resource = course.learning_resource

    learning_resource.published = is_published

    now = now_in_utc()
    start_date = now + timedelta(10) if has_upcoming_run else now - timedelta(10)
    end_date = start_date + timedelta(30)
    old_start_date = now - timedelta(365)
    old_end_date = old_start_date + timedelta(30)

    if course_exists:
        run = LearningResourceRunFactory.create(
            learning_resource=learning_resource,
            published=True,
            enrollment_start=start_date - timedelta(30),
            start_date=start_date,
            end_date=end_date,
            enrollment_end=end_date - timedelta(30),
        )
        old_run = LearningResourceRunFactory.create(
            learning_resource=learning_resource,
            published=True,
            start_date=old_start_date,
            end_date=old_end_date,
            enrollment_start=old_start_date - timedelta(30),
            enrollment_end=old_end_date - timedelta(30),
        )
        learning_resource.runs.set([run, old_run])
        learning_resource.save()
    else:
        run = LearningResourceRunFactory.build(
            start_date=start_date,
            end_date=end_date,
            enrollment_start=start_date - timedelta(30),
            enrollment_end=end_date - timedelta(30),
        )
        old_run = LearningResourceRunFactory.build(
            learning_resource=learning_resource,
            published=True,
            start_date=old_start_date,
            end_date=old_end_date,
            enrollment_start=old_start_date - timedelta(30),
            enrollment_end=old_end_date - timedelta(30),
        )
    assert Course.objects.count() == (1 if course_exists else 0)
    if has_departments:
        department = LearningResourceDepartmentFactory.create()
        departments = [department.department_id]
    else:
        departments = []
    delivery_data = {"delivery": [delivery]} if delivery else {}
    props = {
        "readable_id": learning_resource.readable_id,
        "platform": platform.code,
        "professional": True,
        "title": learning_resource.title,
        "image": {"url": learning_resource.image.url},
        "description": learning_resource.description,
        "url": learning_resource.url,
        "published": is_published,
        "departments": departments,
        **delivery_data,
    }

    if is_run_published:
        runs = [
            {
                "run_id": old_run.run_id,
                "enrollment_start": old_run.enrollment_start,
                "start_date": old_run.start_date,
                "end_date": old_run.end_date,
                "prices": [
                    {"amount": Decimal("30.00"), "currency": CURRENCY_USD},
                    {"amount": Decimal("120.00"), "currency": CURRENCY_USD},
                ],
            },
            {
                "run_id": run.run_id,
                "enrollment_start": run.enrollment_start,
                "start_date": run.start_date,
                "end_date": run.end_date,
                "prices": [
                    {"amount": Decimal("0.00"), "currency": CURRENCY_USD},
                    {"amount": Decimal("49.00"), "currency": CURRENCY_USD},
                ],
            },
        ]
        props["runs"] = runs
    else:
        props["runs"] = []

    blocklist = [learning_resource.readable_id] if blocklisted else []

    result = load_course(props, blocklist, [], config=CourseLoaderConfig(prune=True))
    assert result.professional is True

    if is_published and is_run_published and not blocklisted and has_upcoming_run:
        assert result.next_start_date == start_date
    else:
        assert result.next_start_date is None
    assert result.prices == (
        [Decimal("0.00"), Decimal("49.00")]
        if is_run_published and result.certification
        else []
    )
    assert [price.amount for price in result.resource_prices.all()] == (
        [Decimal("0.00"), Decimal("49.00")]
        if is_run_published and result.certification
        else []
    )

    if course_exists and ((not is_published or not is_run_published) or blocklisted):
        mock_upsert_tasks.deindex_learning_resource_immutable_signature.assert_called_with(
            result.id, result.resource_type
        )
    elif is_published and is_run_published and not blocklisted:
        mock_upsert_tasks.upsert_learning_resource_immutable_signature.assert_called_with(
            result.id
        )
    else:
        mock_upsert_tasks.deindex_learning_resource_immutable_signature.assert_not_called()
        mock_upsert_tasks.upsert_learning_resource_immutable_signature.assert_not_called()

    if course_exists and is_published and not blocklisted:
        course.refresh_from_db()
        assert course.learning_resource.runs.last().published is is_run_published
        assert course.learning_resource.published == (is_published and is_run_published)

    assert Course.objects.count() == 1
    assert LearningResourceRun.objects.filter(published=True).count() == (
        2 if is_run_published else 0
    )

    # assert we got a course back
    assert isinstance(result, LearningResource)

    assert result.delivery == (
        [delivery if delivery is not None else LearningResourceDelivery.online.name]
    )

    if departments == []:
        assert result.departments.count() == 0
    else:
        assert result.departments.count() == 1
        assert result.departments.first().department_id == departments[0]

    props.pop("delivery")
    for key, value in props.items():
        assert getattr(result, key) == value, f"Property {key} should equal {value}"


def test_load_course_bad_platform(mocker):
    """A bad platform should log an exception and not create the course"""
    mock_log = mocker.patch("learning_resources.etl.loaders.log.exception")
    bad_platform = "bad_platform"
    props = {
        "readable_id": "abc123",
        "platform": bad_platform,
        "etl_source": ETLSource.ocw.name,
        "title": "course title",
        "image": {"url": "https://www.test.edu/image.jpg"},
        "description": "description",
        "url": "https://test.edu",
        "published": True,
        "runs": [
            {
                "run_id": "test_run_id",
                "enrollment_start": now_in_utc(),
                "start_date": now_in_utc(),
                "end_date": now_in_utc(),
            }
        ],
    }
    result = load_course(props, [], [], config=CourseLoaderConfig(prune=True))
    assert result is None
    mock_log.assert_called_once_with(
        "Platform %s is null or not in database: %s", bad_platform, "abc123"
    )


@pytest.mark.parametrize("course_exists", [True, False])
@pytest.mark.parametrize("course_id_is_duplicate", [True, False])
@pytest.mark.parametrize("duplicate_course_exists", [True, False])
def test_load_duplicate_course(
    mock_upsert_tasks,
    course_exists,
    course_id_is_duplicate,
    duplicate_course_exists,
):
    """Test that load_course loads the course"""
    platform = LearningResourcePlatformFactory.create()

    course = (
        CourseFactory.create(learning_resource__runs=[], platform=platform.code)
        if course_exists
        else CourseFactory.build()
    )

    duplicate_course = (
        CourseFactory.create(learning_resource__runs=[], platform=platform.code)
        if duplicate_course_exists
        else CourseFactory.build()
    )

    if course_exists and duplicate_course_exists:
        assert Course.objects.count() == 2
    elif course_exists or duplicate_course_exists:
        assert Course.objects.count() == 1
    else:
        assert Course.objects.count() == 0

    duplicates = [
        {
            "course_id": course.learning_resource.readable_id,
            "duplicate_course_ids": [
                course.learning_resource.readable_id,
                duplicate_course.learning_resource.readable_id,
            ],
        }
    ]

    course_id = (
        duplicate_course.learning_resource.readable_id
        if course_id_is_duplicate
        else course.learning_resource.readable_id
    )

    props = {
        "readable_id": course_id,
        "platform": platform.code,
        "title": "New title",
        "description": "something",
        "runs": [
            {
                "run_id": course.learning_resource.readable_id,
                "enrollment_start": "2017-01-01T00:00:00Z",
                "start_date": "2017-01-20T00:00:00Z",
                "end_date": "2017-06-20T00:00:00Z",
            }
        ],
    }

    result = load_course(props, [], duplicates)

    if course_id_is_duplicate and duplicate_course_exists:
        mock_upsert_tasks.deindex_learning_resource_immutable_signature.assert_called()
    else:
        mock_upsert_tasks.deindex_learning_resource_immutable_signature.assert_not_called()
    if course.learning_resource.id:
        mock_upsert_tasks.upsert_learning_resource_immutable_signature.assert_called_with(
            course.learning_resource.id
        )

    assert Course.objects.count() == (2 if duplicate_course_exists else 1)

    assert isinstance(result, LearningResource)

    saved_course = LearningResource.objects.filter(
        readable_id=course.learning_resource.readable_id
    ).first()

    for key, value in props.items():
        assert getattr(result, key) == value, f"Property {key} should equal {value}"
        assert getattr(saved_course, key) == value, (
            f"Property {key} should be updated to {value} in the database"
        )


@pytest.mark.parametrize("unique_url", [True, False])
def test_load_course_unique_urls(unique_url):
    """
    If url is supposed to be unique field, unpublish unpublished courses with same url
    and update the published course with the new readable id
    """
    unique_url = "https://mit.edu/unique.html"
    readable_id = "new_unique_course_id"
    platform = LearningResourcePlatformFactory.create(code=PlatformType.ocw.name)
    old_unpublished_courses = LearningResourceFactory.create_batch(
        2, url=unique_url, platform=platform, is_course=True, published=False
    )
    old_course = LearningResourceFactory.create(
        url=unique_url, platform=platform, is_course=True
    )
    props = {
        "readable_id": readable_id,
        "platform": PlatformType.ocw.name,
        "offered_by": {"code": OfferedBy.ocw.name},
        "title": "New title",
        "url": unique_url,
        "description": "something",
        "unique_field": "url",
        "runs": [
            {
                "run_id": "run_id",
                "enrollment_start": "2024-01-01T00:00:00Z",
                "start_date": "2024-01-20T00:00:00Z",
                "end_date": "2024-06-20T00:00:00Z",
            }
        ],
    }
    result = load_course(props, [], [])
    assert result.readable_id == readable_id
    assert result.url == unique_url
    assert result.published is True
    for unpublished_course in old_unpublished_courses:
        assert (
            LearningResource.objects.filter(pk=unpublished_course.id).exists() is False
        )
    old_course.refresh_from_db()
    assert old_course == result


def test_load_course_old_id_new_url():
    """
    If url is supposed to be unique field, and a resource with the same readable_id
    but different url exists, that resource should be updated with the new url.
    """
    unique_url = "https://mit.edu/unique.html"
    readable_id = "new_unique_course_id"
    platform = LearningResourcePlatformFactory.create(code=PlatformType.ocw.name)
    existing_course = LearningResourceFactory.create(
        readable_id=readable_id,
        url="https://mit.edu/old.html",
        platform=platform,
        is_course=True,
    )
    props = {
        "readable_id": readable_id,
        "platform": PlatformType.ocw.name,
        "offered_by": {"code": OfferedBy.ocw.name},
        "title": "New title",
        "url": unique_url,
        "description": "something",
        "unique_field": "url",
        "runs": [
            {
                "run_id": "run_id",
                "enrollment_start": "2024-01-01T00:00:00Z",
                "start_date": "2024-01-20T00:00:00Z",
                "end_date": "2024-06-20T00:00:00Z",
            }
        ],
    }
    result = load_course(props, [], [])
    assert result.readable_id == readable_id
    assert result.url == unique_url
    assert result.published is True
    existing_course.refresh_from_db()
    assert existing_course.url == unique_url
    assert existing_course.readable_id == readable_id


@pytest.mark.parametrize("course_exists", [True, False])
def test_load_course_fetch_only(mocker, course_exists):
    """When fetch_only is True, course should just be fetched from db"""
    mock_next_runs_prices = mocker.patch(
        "learning_resources.etl.loaders.load_run_dependent_values"
    )
    mock_warn = mocker.patch("learning_resources.etl.loaders.log.warning")
    platform = LearningResourcePlatformFactory.create(code=PlatformType.mitpe.name)
    if course_exists:
        resource = LearningResourceFactory.create(is_course=True, platform=platform)
    else:
        resource = LearningResourceFactory.build(is_course=True, platform=platform)

    props = {
        "readable_id": resource.readable_id,
        "platform": platform.code,
        "offered_by": {"code": OfferedBy.ocw.name},
    }
    result = load_course(props, [], [], config=CourseLoaderConfig(fetch_only=True))
    if course_exists:
        assert result == resource
        mock_warn.assert_not_called()
    else:
        assert result is None
        mock_warn.assert_called_once_with(
            "No published resource found for %s", resource.readable_id
        )
    mock_next_runs_prices.assert_not_called()


@pytest.mark.parametrize("run_exists", [True, False])
@pytest.mark.parametrize("status", [RunStatus.archived.value, RunStatus.current.value])
@pytest.mark.parametrize("certification", [True, False])
@pytest.mark.django_db(transaction=True)
def test_load_run(mocker, run_exists, status, certification):
    """Test that load_run loads the course run"""
    today = now_in_utc()
    mock_import_task = mocker.patch(
        "learning_resources.tasks.import_content_files",
    )
    course = LearningResourceFactory.create(
        is_course=True,
        runs=[],
        certification=certification,
        etl_source=ETLSource.xpro.value,
    )
    learning_resource_run = (
        LearningResourceRunFactory.create(
            learning_resource=course,
        )
        if run_exists
        else LearningResourceRunFactory.build()
    )
    prices = [Decimal("70.00"), Decimal("20.00")]
    props = model_to_dict(
        LearningResourceRunFactory.build(
            run_id=learning_resource_run.run_id,
            prices=["70.00", "20.00"],
            enrollment_start=today - timedelta(days=30),
            enrollment_end=today + timedelta(days=30),
        )
    )
    props["status"] = status
    props["prices"] = [{"amount": price, "currency": CURRENCY_USD} for price in prices]

    del props["id"]
    del props["learning_resource"]
    del props["resource_prices"]

    assert LearningResourceRun.objects.count() == (1 if run_exists else 0)
    assert course.certification == certification

    result = load_run(course, props)

    assert LearningResourceRun.objects.count() == 1

    assert result.learning_resource == course

    assert isinstance(result, LearningResourceRun)
    assert result.prices == (
        []
        if (status == RunStatus.archived.value or certification is False)
        else sorted(prices)
    )

    assert [price.amount for price in result.resource_prices.all()] == (
        []
        if (status == RunStatus.archived.value or certification is False)
        else sorted(prices)
    )
    for key, value in props.items():
        assert getattr(result, key) == value, f"Property {key} should equal {value}"

    # import_content_files is called for best runs (regardless of whether they're new)
    # when the course is from an edx source (xpro in this case)
    course.refresh_from_db()
    if result == course.best_run:
        mock_import_task.delay.assert_called_once_with(
            course.etl_source, learning_resource_ids=[course.id]
        )
    else:
        mock_import_task.delay.assert_not_called()


@pytest.mark.parametrize(
    "etl_source",
    [ETLSource.mit_edx.value, ETLSource.mitxonline.value, ETLSource.xpro.value],
)
@pytest.mark.django_db(transaction=True)
def test_load_run_calls_import_content_files_for_best_run(mocker, etl_source):
    """Test that load_run calls import_content_files for best runs even if not newly created"""
    from datetime import UTC, datetime

    mock_import_task = mocker.patch(
        "learning_resources.tasks.import_content_files",
    )

    # Create course with an existing older run
    course = LearningResourceFactory.create(
        is_course=True,
        create_runs=False,
        etl_source=etl_source,
        published=True,
    )
    LearningResourceRunFactory.create(
        learning_resource=course,
        start_date=datetime(2023, 1, 1, tzinfo=UTC),
    )

    # Load a newer run that will become the best run
    newer_run_props = model_to_dict(
        LearningResourceRunFactory.build(
            start_date=datetime(2024, 1, 1, tzinfo=UTC),
        )
    )
    newer_run_props["prices"] = []
    del newer_run_props["id"]
    del newer_run_props["learning_resource"]
    del newer_run_props["resource_prices"]

    result = load_run(course, newer_run_props)

    course.refresh_from_db()
    assert result == course.best_run

    mock_import_task.delay.assert_called_once_with(
        course.etl_source, learning_resource_ids=[course.id]
    )


@pytest.mark.parametrize(
    "etl_source",
    [ETLSource.mit_edx.value, ETLSource.mitxonline.value, ETLSource.xpro.value],
)
@pytest.mark.parametrize("run_exists", [True, False])
@pytest.mark.django_db(transaction=True)
def test_load_run_calls_import_content_files_for_test_mode(
    mocker, etl_source, run_exists
):
    """Test that load_run calls import_content_files for test_mode courses regardless of best_run"""
    from datetime import UTC, datetime

    mock_import_task = mocker.patch(
        "learning_resources.tasks.import_content_files",
    )

    # Create test_mode course
    course = LearningResourceFactory.create(
        is_course=True,
        create_runs=False,
        etl_source=etl_source,
        published=False,
        test_mode=True,
    )

    if run_exists:
        # Create an existing run that's already the best run
        existing_run = LearningResourceRunFactory.create(
            learning_resource=course,
            start_date=datetime(2024, 1, 1, tzinfo=UTC),
        )
        course.refresh_from_db()

        # Update the existing run with new data
        run_props = model_to_dict(existing_run)
        run_props["title"] = "Updated Title"
        run_props["prices"] = []
        run_props["instructors"] = []
        run_props["image"] = None
        del run_props["id"]
        del run_props["learning_resource"]
        del run_props["resource_prices"]
    else:
        # Create new run
        run_props = model_to_dict(
            LearningResourceRunFactory.build(
                start_date=datetime(2024, 1, 1, tzinfo=UTC),
            )
        )
        run_props["prices"] = []
        run_props["image"] = None
        del run_props["id"]
        del run_props["learning_resource"]
        del run_props["resource_prices"]

    result = load_run(course, run_props)

    # For test_mode courses, import_content_files should always be called
    mock_import_task.delay.assert_called_once_with(
        course.etl_source, learning_resource_ids=[course.id]
    )
    assert result.learning_resource.test_mode is True


@pytest.mark.parametrize(
    "etl_source",
    [ETLSource.mit_edx.value, ETLSource.mitxonline.value, ETLSource.xpro.value],
)
def test_load_run_skips_import_content_files_for_non_best_run_published_course(
    mocker, etl_source
):
    """Test that load_run doesn't call import_content_files for non-best runs of published courses"""
    from datetime import UTC, datetime

    mock_import_task = mocker.patch(
        "learning_resources.tasks.import_content_files",
    )

    # Create published (non-test-mode) course with existing best run
    course = LearningResourceFactory.create(
        is_course=True,
        create_runs=False,
        etl_source=etl_source,
        published=True,
        test_mode=False,
    )

    # Create the best run (newer date)
    best_run = LearningResourceRunFactory.create(
        learning_resource=course,
        start_date=datetime(2024, 6, 1, tzinfo=UTC),
    )
    course.refresh_from_db()
    assert course.best_run == best_run

    # Now add an older run that won't be the best run
    older_run_props = model_to_dict(
        LearningResourceRunFactory.build(
            start_date=datetime(2023, 1, 1, tzinfo=UTC),
        )
    )
    older_run_props["prices"] = []
    del older_run_props["id"]
    del older_run_props["learning_resource"]
    del older_run_props["resource_prices"]

    result = load_run(course, older_run_props)

    course.refresh_from_db()

    # Verify the result is not the best run
    assert result != course.best_run

    # import_content_files should not be called for non-best runs
    mock_import_task.delay.assert_not_called()


@pytest.mark.parametrize(
    "etl_source",
    [ETLSource.ocw.value, ETLSource.oll.value, ETLSource.youtube.value],
)
def test_load_run_skips_import_content_files_for_unsupported_sources(
    mocker, etl_source
):
    """Test that load_run doesn't call import_content_files for non-edx sources"""
    mock_import_task = mocker.patch(
        "learning_resources.tasks.import_content_files",
    )

    course = LearningResourceFactory.create(
        is_course=True,
        create_runs=False,
        etl_source=etl_source,
        published=True,
    )

    run_props = model_to_dict(LearningResourceRunFactory.build())
    run_props["prices"] = []
    del run_props["id"]
    del run_props["learning_resource"]
    del run_props["resource_prices"]

    load_run(course, run_props)

    # import_content_files should not be called for non-edx sources
    mock_import_task.delay.assert_not_called()


@pytest.mark.parametrize(
    "etl_source",
    [ETLSource.mit_edx.value, ETLSource.mitxonline.value, ETLSource.xpro.value],
)
@pytest.mark.django_db(transaction=True)
def test_load_run_skips_import_content_files_when_content_files_exist(
    mocker, etl_source
):
    """Test that load_run doesn't call import_content_files when content files already exist"""
    mock_import_task = mocker.patch(
        "learning_resources.tasks.import_content_files",
    )

    course = LearningResourceFactory.create(
        is_course=True,
        create_runs=False,
        etl_source=etl_source,
        published=True,
    )
    run = LearningResourceRunFactory.create(
        learning_resource=course,
    )
    # Add existing content files to the run
    ContentFileFactory.create_batch(3, run=run)
    course.refresh_from_db()
    assert course.best_run == run
    assert run.content_files.count() == 3

    # Update the existing run (not creating a new one)
    run_props = model_to_dict(run)
    run_props["title"] = "Updated Title"
    run_props["prices"] = []
    run_props["instructors"] = []
    run_props["image"] = None
    del run_props["id"]
    del run_props["learning_resource"]
    del run_props["resource_prices"]

    result = load_run(course, run_props)

    course.refresh_from_db()
    assert result == course.best_run

    # import_content_files should NOT be called because content files already exist
    mock_import_task.delay.assert_not_called()


@pytest.mark.parametrize("parent_factory", [CourseFactory, ProgramFactory])
@pytest.mark.parametrize("topics_exist", [True, False])
def test_load_topics(mocker, parent_factory, topics_exist):
    """Test that load_topics assigns topics to the parent object"""

    topics = (
        LearningResourceTopicFactory.create_batch(3)
        if topics_exist
        else LearningResourceTopicFactory.build_batch(3)
    )
    parent = parent_factory.create()
    total_topic_count = len(topics) if topics_exist else 0

    load_topics(parent.learning_resource, [])

    assert parent.learning_resource.topics.count() == 0

    load_topics(parent.learning_resource, [{"name": topic.name} for topic in topics])

    assert parent.learning_resource.topics.count() == total_topic_count

    load_topics(parent.learning_resource, None)

    assert parent.learning_resource.topics.count() == total_topic_count

    load_topics(parent.learning_resource, [])

    assert parent.learning_resource.topics.count() == 0


@pytest.mark.parametrize("instructor_exists", [True, False])
def test_load_instructors(instructor_exists):
    """Test that load_instructors creates and/or assigns instructors to the course run"""
    instructors = (
        LearningResourceInstructorFactory.create_batch(3)
        if instructor_exists
        else LearningResourceInstructorFactory.build_batch(3)
    )
    run = LearningResourceRunFactory.create(no_instructors=True)

    assert run.instructors.count() == 0

    load_instructors(
        run, [{"full_name": instructor.full_name} for instructor in instructors]
    )

    assert run.instructors.count() == len(instructors)
    # Instructors should maintain their original order
    assert [i.full_name for i in instructors] == [
        i.full_name for i in run.instructors.all()
    ]


def test_load_instructors_dupe_full_names():
    """Test that no dupe instructors are created and no integrity errors are raised"""
    instructor_data = [
        {"full_name": "John Doe", "first_name": "John", "last_name": "Doe"},
        {"full_name": "", "first_name": "John", "last_name": "Doe"},
        {"full_name": None, "first_name": "John", "last_name": "Doe"},
        {"full_name": "John Doe", "email": "johndoe@test.edu"},
        {"first_name": "John", "last_name": "Doe", "profession": "QA analyst"},
    ]
    run = LearningResourceRunFactory.create(no_instructors=True)

    assert run.instructors.count() == 0

    load_instructors(run, instructor_data)

    assert run.instructors.count() == 1
    assert run.instructors.first().full_name == "John Doe"
    assert run.instructors.first().first_name == "John"
    assert run.instructors.first().last_name == "Doe"


def test_load_instructors_no_full_name():
    """Test that instructors with no full name are not created"""
    instructor_data = [
        {"full_name": " ", "first_name": "", "last_name": " "},
        {"full_name": "", "first_name": None, "last_name": ""},
        {"full_name": None, "first_name": "", "last_name": None},
    ]
    run = LearningResourceRunFactory.create(no_instructors=True)

    assert run.instructors.count() == 0
    load_instructors(run, instructor_data)
    assert run.instructors.count() == 0


@pytest.mark.parametrize("parent_factory", [CourseFactory, ProgramFactory])
@pytest.mark.parametrize("offeror_exists", [True, False])
@pytest.mark.parametrize("has_other_offered_by", [True, False])
@pytest.mark.parametrize("null_data", [True, False])
def test_load_offered_bys(
    parent_factory, offeror_exists, has_other_offered_by, null_data
):
    """Test that load_offered_bys creates and/or assigns offeror to the parent object"""
    resource = parent_factory.create().learning_resource
    LearningResourceOfferor.objects.all().delete()

    ocw_offeror = (
        LearningResourceOfferorFactory.create(is_ocw=True) if offeror_exists else None
    )
    mitx_offeror = LearningResourceOfferorFactory.create(is_mitx=True)

    resource.offered_by = mitx_offeror if has_other_offered_by else None
    resource.save()

    expected = None
    if offeror_exists and not null_data:
        expected = ocw_offeror

    load_offered_by(resource, None if null_data else {"name": "MIT OpenCourseWare"})

    assert resource.offered_by == expected


@pytest.mark.parametrize("prune", [True, False])
def test_load_courses(mocker, mock_blocklist, mock_duplicates, prune):
    """Test that load_courses calls the expected functions"""

    course_to_unpublish = CourseFactory.create(etl_source=ETLSource.xpro.name)
    courses = CourseFactory.create_batch(3, etl_source=ETLSource.xpro.name)

    courses_data = [
        {"readable_id": course.learning_resource.readable_id} for course in courses
    ]

    mock_load_course = mocker.patch(
        "learning_resources.etl.loaders.load_course",
        autospec=True,
        side_effect=[course.learning_resource for course in courses],
    )
    config = CourseLoaderConfig(prune=prune)
    load_courses(ETLSource.xpro.name, courses_data, config=config)
    assert mock_load_course.call_count == len(courses)
    for course_data in courses_data:
        mock_load_course.assert_any_call(
            course_data,
            mock_blocklist.return_value,
            mock_duplicates.return_value,
            config=config,
        )
    mock_blocklist.assert_called_once_with()
    mock_duplicates.assert_called_once_with(ETLSource.xpro.name)
    course_to_unpublish.refresh_from_db()
    assert course_to_unpublish.learning_resource.published is not prune


def test_load_programs(mocker, mock_blocklist, mock_duplicates):
    """Test that load_programs calls the expected functions"""
    program_data = [{"courses": [{"platform": "a"}, {}], "id": 5}]

    mock_load_program = mocker.patch(
        "learning_resources.etl.loaders.load_program",
        autospec=True,
        return_value=ProgramFactory.create().learning_resource,
    )
    load_programs("mitx", program_data, config=ProgramLoaderConfig(prune=True))
    assert mock_load_program.call_count == len(program_data)
    mock_blocklist.assert_called_once()
    mock_duplicates.assert_called_once_with("mitx")


@pytest.mark.parametrize("is_published", [True, False])
@pytest.mark.parametrize("calc_score", [True, False])
def test_load_content_files(mocker, is_published, calc_score):
    """Test that load_content_files calls the expected functions"""
    course = LearningResourceFactory.create(is_course=True, create_runs=False)
    course_run = LearningResourceRunFactory.create(
        published=is_published, learning_resource=course
    )
    LearningResourceRunFactory.create(
        published=is_published,
        learning_resource=course,
        start_date=now_in_utc() - timedelta(days=365),
    )
    assert course.runs.count() == 2

    deleted_content_file = ContentFileFactory.create(run=course_run)
    deleted_content_file_learning_resource = LearningResourceFactory.create(
        resource_type=LearningResourceType.document.value,
    )
    deleted_content_file.learning_material_resource = (
        deleted_content_file_learning_resource
    )
    deleted_content_file.save()

    returned_content_file_id = deleted_content_file.id + 1

    content_data = [{"a": "b"}, {"a": "c"}]
    mock_load_content_file = mocker.patch(
        "learning_resources.etl.loaders.load_content_file",
        return_value=returned_content_file_id,
        autospec=True,
    )
    mock_bulk_index = mocker.patch(
        "learning_resources_search.plugins.tasks.index_run_content_files.si",
    )
    mock_bulk_delete = mocker.patch(
        "learning_resources_search.plugins.tasks.deindex_run_content_files.si",
        autospec=True,
    )

    mocker.patch(
        "learning_resources_search.indexing_api.deindex_run_content_files",
        autospec=True,
    )
    mock_calc_score = mocker.patch(
        "learning_resources.etl.loaders.calculate_completeness"
    )
    load_content_files(course_run, content_data, calc_completeness=calc_score)
    assert mock_load_content_file.call_count == len(content_data)
    assert mock_bulk_index.call_count == (1 if is_published else 0)
    assert mock_bulk_delete.call_count == 0 if is_published else 1
    assert mock_calc_score.call_count == (1 if calc_score else 0)
    deleted_content_file.refresh_from_db()
    deleted_content_file_learning_resource.refresh_from_db()

    assert not deleted_content_file.published
    assert not deleted_content_file_learning_resource.published


@pytest.mark.parametrize("test_mode", [True, False])
def test_load_test_mode_resource_content_files(
    mocker, mock_course_archive_bucket, test_mode
):
    """Test that load_content_files calls the expected functions"""

    course = LearningResourceFactory.create(
        is_course=True,
        create_runs=False,
        test_mode=test_mode,
        published=False,
        etl_source=ETLSource.mit_edx.name,
    )
    course_run = LearningResourceRunFactory.create(
        published=True, learning_resource=course, checksum="testing124"
    )

    ContentFileFactory.create(run=course_run)

    content_data = [{"a": "b"}, {"a": "c"}]

    mock_load_content_files = mocker.patch(
        "learning_resources.etl.edx_shared.load_content_files",
        autospec=True,
        return_value=[],
    )
    mocker.patch(
        "learning_resources_search.plugins.tasks.deindex_run_content_files",
        autospec=True,
    )
    bucket = mock_course_archive_bucket.bucket
    with Path.open(
        Path("test_json/course-v1:MITxT+8.01.3x+3T2022.tar.gz"), "rb"
    ) as infile:
        bucket.put_object(
            Key=f"{get_s3_prefix_for_source(course.etl_source)}/{course.runs.first().run_id}/foo.tar.gz",
            Body=infile.read(),
            ACL="public-read",
        )
    mocker.patch(
        "learning_resources.etl.edx_shared.get_bucket_by_name",
        return_value=bucket,
    )
    sync_edx_course_files(
        course.etl_source,
        [course.id],
        [
            f"{get_s3_prefix_for_source(course.etl_source)}/{course.runs.first().run_id}/foo.tar.gz"
        ],
    )

    if test_mode:
        assert len(mock_load_content_files.mock_calls[0].args) == len(content_data)
    else:
        assert mock_load_content_files.call_count == 0


def test_load_content_file():
    """Test that load_content_file saves a ContentFile object"""
    learning_resource_run = LearningResourceRunFactory.create()

    props = model_to_dict(ContentFileFactory.build(run_id=learning_resource_run.id))
    props.pop("run")
    props.pop("id")

    result = load_content_file(learning_resource_run, props)

    assert ContentFile.objects.count() == 1

    # assert we got an integer back
    assert isinstance(result, int)

    loaded_file = ContentFile.objects.get(pk=result)
    assert loaded_file.run == learning_resource_run

    for key, value in props.items():
        assert getattr(loaded_file, key) == value, (
            f"Property {key} should equal {value}"
        )


def test_load_problem_file():
    """Test that load_problem_file saves a TutorProblemFile object"""
    learning_resource_run = LearningResourceRunFactory.create()

    props = {
        "problem_title": "Problem 1",
        "type": "problem",
        "source_path": "ai/tutor/problems/Problem 1/problem/problem1",
        "content": "This is the content of the problem file.",
    }

    result = load_problem_file(learning_resource_run, props)

    # assert we got an integer back
    assert isinstance(result, int)

    assert TutorProblemFile.objects.count() == 1

    loaded_file = TutorProblemFile.objects.get(pk=result)
    assert loaded_file.run == learning_resource_run

    for key, value in props.items():
        assert getattr(loaded_file, key) == value, (
            f"Property {key} should equal {value}"
        )


def test_load_problem_files(mocker):
    """Test that load_content_files calls the expected functions"""
    course = LearningResourceFactory.create(is_course=True, create_runs=False)
    course_run = LearningResourceRunFactory.create(learning_resource=course)
    LearningResourceRunFactory.create(
        learning_resource=course,
        start_date=now_in_utc() - timedelta(days=365),
    )
    assert course.runs.count() == 2

    deleted_problem_file = ContentFileFactory.create(run=course_run)

    content_data = [
        {
            "problem_title": "Problem 1",
            "type": "problem",
            "source_path": "ai/tutor/problems/Problem 1/problem/problem1",
        },
        {
            "problem_title": "Problem 1",
            "type": "solution",
            "source_path": "ai/tutor/problems/Problem 1/solution/sol1",
        },
    ]

    load_problem_files(course_run, content_data)

    assert TutorProblemFile.objects.filter(id=deleted_problem_file.id).exists() is False
    for file in content_data:
        assert TutorProblemFile.objects.filter(
            run=course_run, source_path=file["source_path"]
        ).exists()


def test_load_image():
    """Test that image resources are uniquely created or retrieved based on parameters"""
    resource_url = "https://mit.edu"
    LearningResourceImage.objects.filter(url=resource_url).delete()
    learning_resource = LearningResourceFactory.create()

    # first image should be different from second due to 'description' parameter
    image_a = load_image(learning_resource, image_data={"url": resource_url})
    image_b = load_image(
        learning_resource, image_data={"url": resource_url, "description": ""}
    )
    assert image_a.id != image_b.id

    # first image should be the same as third image since url and alt field matches
    image_c = load_image(
        learning_resource, image_data={"url": resource_url, "alt": None}
    )
    assert image_a.id == image_c.id

    # fourth image should have a totally new id since all fields are unique
    image_d = load_image(
        learning_resource,
        image_data={"url": resource_url, "alt": "test", "description": "new"},
    )
    assert image_d.id not in {image_a.id, image_b.id, image_c.id}


def test_load_content_file_error(mocker):
    """Test that an exception in load_content_file is logged"""
    learning_resource_run = LearningResourceRunFactory.create()
    mock_log = mocker.patch("learning_resources.etl.loaders.log.exception")
    load_content_file(learning_resource_run, {"uid": "badfile", "bad": "data"})
    mock_log.assert_called_once_with(
        "ERROR syncing course file %s for run %d", "badfile", learning_resource_run.id
    )


def test_load_podcasts(learning_resource_offeror, podcast_platform):
    """Test load_podcasts"""

    podcasts_data = []
    for podcast in PodcastFactory.build_batch(3):
        episodes = PodcastEpisodeFactory.build_batch(3)
        podcast_data = model_to_dict(
            podcast.learning_resource, exclude=non_transformable_attributes
        )
        podcast_data["image"] = {"url": podcast.learning_resource.image.url}
        podcast_data["offered_by"] = {"name": learning_resource_offeror.name}
        episodes_data = [
            {
                **model_to_dict(
                    episode.learning_resource, exclude=non_transformable_attributes
                ),
                "offered_by": {"name": learning_resource_offeror.name},
            }
            for episode in episodes
        ]
        podcast_data["episodes"] = episodes_data
        podcasts_data.append(podcast_data)
    results = load_podcasts(podcasts_data)

    assert len(results) == len(podcasts_data)

    for result in results:
        assert isinstance(result, LearningResource)
        assert result.delivery == [LearningResourceDelivery.online.name]
        assert result.resource_type == LearningResourceType.podcast.name
        assert result.platform.code == PlatformType.podcast.name
        assert result.children.count() > 0
        for relation in result.children.all():
            assert (
                relation.child.resource_type
                == LearningResourceType.podcast_episode.name
            )
            assert (
                relation.relation_type
                == LearningResourceRelationTypes.PODCAST_EPISODES.value
            )


def test_load_podcasts_unpublish(podcast_platform):
    """Test load_podcast when a podcast gets unpublished"""
    podcast = PodcastFactory.create().learning_resource
    assert podcast.published is True
    assert podcast.children.count() > 0
    for relation in podcast.children.all():
        assert relation.child.published is True

    load_podcasts([])

    podcast.refresh_from_db()

    assert podcast.published is False
    assert podcast.children.count() > 0
    for relation in podcast.children.all():
        assert relation.child.published is False


@pytest.mark.parametrize("podcast_episode_exists", [True, False])
@pytest.mark.parametrize("is_published", [True, False])
def test_load_podcast_episode(
    mock_upsert_tasks,
    learning_resource_offeror,
    podcast_platform,
    podcast_episode_exists,
    is_published,
):
    """Test that load_podcast_episode loads the podcast episode"""
    podcast_episode = (
        LearningResourceFactory.create(published=is_published, is_podcast_episode=True)
        if podcast_episode_exists
        else LearningResourceFactory.build(
            published=is_published, is_podcast_episode=True
        )
    )

    props = model_to_dict(podcast_episode, exclude=non_transformable_attributes)
    props["image"] = {"url": podcast_episode.image.url}
    props["offered_by"] = {"name": learning_resource_offeror.name}
    topics = (
        podcast_episode.topics.all()
        if podcast_episode_exists
        else LearningResourceTopicFactory.build_batch(2)
    )
    props["topics"] = [model_to_dict(topic, exclude=["id"]) for topic in topics]

    result = load_podcast_episode(props)

    assert PodcastEpisode.objects.count() == 1

    # assert we got a podcast episode back
    assert isinstance(result, LearningResource)
    assert result.resource_type == LearningResourceType.podcast_episode.name
    assert result.podcast_episode is not None

    for key, value in props.items():
        assert getattr(result, key) == value, f"Property {key} should equal {value}"

    if podcast_episode_exists and not is_published:
        mock_upsert_tasks.deindex_learning_resource_immutable_signature.assert_called_with(
            result.id, result.resource_type
        )
    elif is_published:
        mock_upsert_tasks.upsert_learning_resource_immutable_signature.assert_called_with(
            result.id
        )
    else:
        mock_upsert_tasks.upsert_learning_resource_immutable_signature.assert_not_called()
        mock_upsert_tasks.deindex_learning_resource.assert_not_called()


@pytest.mark.parametrize("podcast_exists", [True, False])
@pytest.mark.parametrize("is_published", [True, False])
def test_load_podcast(
    mock_upsert_tasks,
    learning_resource_offeror,
    podcast_platform,
    podcast_exists,
    is_published,
):
    """Test that load_podcast loads the podcast"""
    podcast = (
        PodcastFactory.create(episodes=[], is_unpublished=not is_published)
        if podcast_exists
        else PodcastFactory.build(episodes=[], is_unpublished=not is_published)
    ).learning_resource
    existing_podcast_episode = (
        PodcastEpisodeFactory.create(is_unpublished=not is_published).learning_resource
        if podcast_exists
        else None
    )
    if existing_podcast_episode:
        podcast.resources.set(
            [existing_podcast_episode],
            through_defaults={
                "relation_type": LearningResourceRelationTypes.PODCAST_EPISODES.value
            },
        )
        assert podcast.resources.count() == 1

    podcast_data = model_to_dict(podcast, exclude=non_transformable_attributes)
    podcast_data["title"] = "New Title"
    podcast_data["image"] = {"url": podcast.image.url}
    podcast_data["offered_by"] = {"name": learning_resource_offeror.name}
    topics = (
        podcast.topics.all()
        if podcast_exists
        else LearningResourceTopicFactory.build_batch(2)
    )
    podcast_data["topics"] = [model_to_dict(topic) for topic in topics]

    episode = PodcastEpisodeFactory.build().learning_resource
    episode_data = model_to_dict(episode, exclude=non_transformable_attributes)
    episode_data["image"] = {"url": episode.image.url}
    episode_data["offered_by"] = {"name": learning_resource_offeror.name}

    podcast_data["episodes"] = [episode_data]
    result = load_podcast(podcast_data)

    new_podcast = LearningResource.objects.get(readable_id=podcast.readable_id)
    new_podcast_episode = new_podcast.resources.order_by("-created_on").first()

    assert new_podcast.title == "New Title"

    if is_published:
        assert new_podcast_episode.published is True

    if podcast_exists and is_published:
        assert new_podcast.id == podcast.id
        assert new_podcast.resources.count() == 2
    elif podcast_exists or is_published:
        assert new_podcast.resources.count() == 1
    else:
        assert new_podcast.resources.count() == 0

    if podcast_exists and not is_published:
        mock_upsert_tasks.deindex_learning_resource_immutable_signature.assert_called_with(
            result.id, result.resource_type
        )
    elif is_published:
        mock_upsert_tasks.upsert_learning_resource_immutable_signature.assert_called_with(
            result.id
        )
    else:
        mock_upsert_tasks.deindex_learning_resource_immutable_signature.assert_not_called()
        mock_upsert_tasks.upsert_learning_resource_immutable_signature.assert_not_called()


@pytest.mark.parametrize("video_exists", [True, False])
@pytest.mark.parametrize("is_published", [True, False])
@pytest.mark.parametrize("pass_topics", [True, False])
def test_load_video(mocker, video_exists, is_published, pass_topics):
    """Test that a video is properly loaded and saved"""
    expected_topics = [{"name": "Biology"}, {"name": "Chemistry"}]
    [
        LearningResourceTopicFactory.create(name=topic["name"])
        for topic in expected_topics
    ]

    video_resource = (
        VideoFactory.create() if video_exists else VideoFactory.build()
    ).learning_resource
    offered_by = LearningResourceOfferorFactory.create()

    mock_similar_topics_action = mocker.patch(
        "learning_resources.etl.loaders.similar_topics_action",
        return_value=expected_topics,
    )

    assert Video.objects.count() == (1 if video_exists else 0)

    props = {
        "readable_id": video_resource.readable_id,
        "platform": PlatformType.youtube.name,
        "resource_type": LearningResourceType.video.name,
        "etl_source": ETLSource.youtube.name,
        "title": video_resource.title,
        "description": video_resource.description,
        "full_description": video_resource.full_description,
        "image": {"url": video_resource.image.url},
        "last_modified": video_resource.last_modified,
        "url": video_resource.url,
        "offered_by": {"code": offered_by.code},
        "published": is_published,
        "video": {"duration": video_resource.video.duration},
    }
    if pass_topics:
        props["topics"] = expected_topics

    result = load_video(props)
    assert Video.objects.count() == 1

    # assert we got a video resource back
    assert isinstance(result, LearningResource)
    assert result.published == is_published

    assert mock_similar_topics_action.call_count == (0 if pass_topics else 1)
    assert list(result.topics.values_list("name", flat=True).order_by("name")) == [
        topic["name"] for topic in expected_topics
    ]

    for key, value in props.items():
        assert getattr(result, key) == value, f"Property {key} should equal {value}"


def test_load_videos(mocker, mock_get_similar_topics_qdrant):
    """Verify that load_videos loads a list of videos"""
    assert Video.objects.count() == 0

    video_resources = [video.learning_resource for video in VideoFactory.build_batch(5)]
    videos_data = [
        {
            **model_to_dict(video, exclude=non_transformable_attributes),
            "offered_by": {"code": LearningResourceOfferorFactory.create().code},
            "platform": PlatformType.youtube.name,
        }
        for video in video_resources
    ]

    results = load_videos(videos_data)

    assert len(results) == len(video_resources)

    assert Video.objects.count() == len(video_resources)


@pytest.mark.parametrize("playlist_exists", [True, False])
def test_load_playlist(mocker, playlist_exists, mock_get_similar_topics_qdrant):
    """Test load_playlist"""
    expected_topics = [{"name": "Biology"}, {"name": "Physics"}]
    [
        LearningResourceTopicFactory.create(name=topic["name"])
        for topic in expected_topics
    ]

    mock_most_common_topics = mocker.patch(
        "learning_resources.etl.loaders.most_common_topics",
        return_value=expected_topics,
    )
    channel = VideoChannelFactory.create()
    if playlist_exists:
        playlist = VideoPlaylistFactory.create(channel=channel).learning_resource
        deleted_video = VideoFactory.create().learning_resource
        playlist.resources.add(
            deleted_video,
            through_defaults={
                "relation_type": LearningResourceRelationTypes.PLAYLIST_VIDEOS,
                "position": 1,
            },
        )
    else:
        playlist = VideoPlaylistFactory.build().learning_resource

    video_resources = [video.learning_resource for video in VideoFactory.build_batch(5)]
    videos_data = [
        {
            **model_to_dict(video, exclude=non_transformable_attributes),
            "platform": PlatformType.youtube.name,
            "offered_by": {"code": LearningResourceOfferorFactory.create().code},
        }
        for video in video_resources
    ]

    props = {
        **model_to_dict(playlist, exclude=["topics", *non_transformable_attributes]),
        "platform": PlatformType.youtube.name,
        "offered_by": {"code": LearningResourceOfferorFactory.create().code},
        "playlist_id": playlist.readable_id,
        "url": f"https://youtube.com/playlist?list={playlist.readable_id}",
        "image": {
            "url": f"https://i.ytimg.com/vi/{playlist.readable_id}/hqdefault.jpg",
            "alt": playlist.title,
        },
        "videos": videos_data,
    }

    result = load_playlist(channel, props)

    assert isinstance(result, LearningResource)
    mock_most_common_topics.assert_called_once()

    assert result.resources.count() == len(video_resources)
    assert result.video_playlist.channel == channel
    assert list(result.topics.values_list("name", flat=True).order_by("name")) == [
        topic["name"] for topic in expected_topics
    ]
    if playlist_exists:
        deleted_video.refresh_from_db()
        assert not deleted_video.published


def test_load_playlists_unpublish(mocker):
    """Test load_playlists when a video/playlist gets unpublished"""
    mocker.patch("learning_resources_search.tasks.bulk_deindex_learning_resources.si")
    channel = VideoChannelFactory.create()

    playlists = sorted(
        VideoPlaylistFactory.create_batch(4, channel=channel),
        key=lambda playlist: playlist.id,
    )
    playlist_id = playlists[0].learning_resource.readable_id
    playlist_title = playlists[0].learning_resource.title
    assert playlists[0].learning_resource.published is True
    playlists_data = [
        {
            "playlist_id": playlist_id,
            "url": f"https://youtube.com/playlist?list={playlist_id}",
            "image": {
                "url": f"https://i.ytimg.com/vi/{playlist_id}/hqdefault.jpg",
                "alt": playlist_title,
            },
            "published": True,
            "videos": [],
        }
    ]

    load_playlists(channel, playlists_data)
    assert (
        LearningResource.objects.filter(
            resource_type="video_playlist", published=True
        ).count()
        == 1
    )

    for playlist in playlists:
        playlist.refresh_from_db()
        if playlist.id == playlists[0].id:
            assert playlist.learning_resource.published is True
        else:
            assert playlist.learning_resource.published is False


def test_load_video_channels():
    """Test load_video_channels"""
    assert VideoChannel.objects.count() == 0
    assert VideoPlaylist.objects.count() == 0

    channels_data = []
    for channel in VideoChannelFactory.build_batch(3):
        channel_data = model_to_dict(channel)

        playlist = VideoPlaylistFactory.build()
        playlist_data = model_to_dict(playlist)
        playlist_id = playlist.learning_resource.readable_id
        playlist_data["playlist_id"] = playlist_id
        playlist_data["url"] = f"https://youtube.com/playlist?list={playlist_id}"
        playlist_data["image"] = {
            "url": f"https://i.ytimg.com/vi/{playlist_id}/hqdefault.jpg",
            "alt": playlist.learning_resource.title,
        }
        del playlist_data["id"]
        del playlist_data["channel"]
        del playlist_data["learning_resource"]

        channel_data["playlists"] = [playlist_data]
        channels_data.append(channel_data)

    results = load_video_channels(channels_data)

    assert len(results) == len(channels_data)

    for result in results:
        assert isinstance(result, VideoChannel)

        assert result.playlists.count() == 1


def test_load_video_channels_error(mocker):
    """Test that an error doesn't fail the entire operation"""

    def pop_channel_id_with_exception(data):
        """Pop channel_id off data and raise an exception"""
        data.pop("channel_id")
        raise ExtractException

    mock_load_channel = mocker.patch(
        "learning_resources.etl.loaders.load_video_channel"
    )
    mock_load_channel.side_effect = pop_channel_id_with_exception
    mock_log = mocker.patch("learning_resources.etl.loaders.log")
    channel_id = "abc"

    load_video_channels([{"channel_id": channel_id}])

    mock_log.exception.assert_called_once_with(
        "Error with extracted video channel: channel_id=%s", channel_id
    )


def test_load_video_channels_unpublish(mock_upsert_tasks):
    """Test load_video_channels when a video/playlist gets unpublished"""
    channel = VideoChannelFactory.create()
    playlist = VideoPlaylistFactory.create(channel=channel).learning_resource
    video = VideoFactory.create().learning_resource
    playlist.resources.set(
        [video],
        through_defaults={
            "relation_type": LearningResourceRelationTypes.PLAYLIST_VIDEOS.value
        },
    )
    assert channel.published is True
    assert video.published is True
    assert playlist.published is True

    # inputs don't matter here
    load_video_channels([])

    video.refresh_from_db()
    assert video.published is False
    playlist.refresh_from_db()
    assert playlist.published is False
    channel.refresh_from_db()
    assert channel.published is False


@pytest.mark.parametrize("course_exists", [True, False])
def test_load_course_percolation(
    mocker,
    mock_upsert_tasks,
    course_exists,
):
    """Test loading a new course triggers percolation"""
    blocklisted = False
    is_published = True
    is_run_published = True
    """Test that load_course loads the course"""
    platform = LearningResourcePlatformFactory.create()

    course = (
        CourseFactory.create(learning_resource__runs=[], platform=platform.code)
        if course_exists
        else CourseFactory.build(learning_resource__runs=[], platform=platform.code)
    )
    learning_resource = course.learning_resource
    learning_resource.published = is_published

    if course_exists:
        run = LearningResourceRunFactory.create(
            learning_resource=learning_resource, published=True
        )
        learning_resource.runs.set([run])
        learning_resource.save()
    else:
        run = LearningResourceRunFactory.build()
    assert Course.objects.count() == (1 if course_exists else 0)

    props = {
        "readable_id": learning_resource.readable_id,
        "platform": platform.code,
        "professional": True,
        "title": learning_resource.title,
        "image": {"url": learning_resource.image.url},
        "description": learning_resource.description,
        "url": learning_resource.url,
        "published": is_published,
    }
    if is_run_published:
        run = {
            "run_id": run.run_id,
            "enrollment_start": run.enrollment_start,
            "start_date": run.start_date,
            "end_date": run.end_date,
        }
        props["runs"] = [run]
    else:
        props["runs"] = []

    blocklist = [learning_resource.readable_id] if blocklisted else []
    result = load_course(props, blocklist, [], config=CourseLoaderConfig(prune=True))
    mock_upsert_tasks.upsert_learning_resource_immutable_signature.assert_called_with(
        result.id
    )


@pytest.mark.parametrize("certification", [True, False])
def test_load_run_dependent_values(certification):
    """Prices and availability should be correctly assigned based on run data"""
    course = LearningResourceFactory.create(
        is_course=True, certification=certification, runs=[]
    )
    assert course.runs.count() == 0
    closest_date = now_in_utc() + timedelta(days=1)
    furthest_date = now_in_utc() + timedelta(days=2)
    best_run = LearningResourceRunFactory.create(
        learning_resource=course,
        published=True,
        availability=Availability.dated.name,
        prices=[Decimal("0.00"), Decimal("20.00")],
        resource_prices=LearningResourcePriceFactory.create_batch(2),
        start_date=closest_date,
        enrollment_start=None,
        location="Portland, ME",
        duration="3 - 4 weeks",
        min_weeks=3,
        max_weeks=4,
        time_commitment="5 - 10 hours per week",
        min_weekly_hours=5,
        max_weekly_hours=10,
    )
    LearningResourceRunFactory.create(
        learning_resource=course,
        published=True,
        availability=Availability.dated.name,
        prices=[Decimal("0.00"), Decimal("50.00")],
        resource_prices=LearningResourcePriceFactory.create_batch(2),
        start_date=furthest_date,
        enrollment_start=None,
        location="Portland, OR",
        duration="7 - 9 weeks",
        min_weeks=7,
        max_weeks=9,
        time_commitment="8 - 9 hours per week",
        min_weekly_hours=8,
        max_weekly_hours=19,
    )
    result = load_run_dependent_values(course)
    course.refresh_from_db()
    assert (
        result.prices == course.prices == ([] if not certification else best_run.prices)
    )
    assert (
        result.next_start_date
        == course.next_start_date
        == best_run.start_date
        == closest_date
    )
    assert (
        list(result.resource_prices)
        == list(course.resource_prices.all())
        == ([] if not certification else list(best_run.resource_prices.all()))
    )
    assert result.availability == course.availability == Availability.dated.name
    assert result.location == course.location == best_run.location
    for key in [
        "duration",
        "time_commitment",
        "min_weeks",
        "max_weeks",
        "min_weekly_hours",
        "max_weekly_hours",
    ]:
        assert getattr(result, key) == getattr(course, key) == getattr(best_run, key)


def test_load_run_dependent_values_resets_next_start_date():
    """Test that next_start_date is reset to None when best_run becomes None"""
    # Create a published course with an existing next_start_date
    previous_date = now_in_utc() + timedelta(days=5)
    course = LearningResourceFactory.create(
        is_course=True,
        published=True,
        next_start_date=previous_date,  # Course previously had a start date
    )

    # Ensure course has no runs, so best_run will return None
    course.runs.all().update(published=False)
    assert course.best_run is None

    # Verify the course initially has a next_start_date
    assert course.next_start_date == previous_date

    # Call load_run_dependent_values
    result = load_run_dependent_values(course)

    # Refresh course from database
    course.refresh_from_db()

    # Verify that next_start_date was reset to None
    assert result.next_start_date is None
    assert course.next_start_date is None


@pytest.mark.parametrize(
    ("has_start_date", "has_enrollment_start", "expect_next_start_date"),
    [
        (True, True, True),
        (True, False, True),
        (False, True, False),  # next_run requires start_date > now
        (False, False, False),
    ],
)
def test_load_run_dependent_values_next_start_date(
    has_start_date, has_enrollment_start, expect_next_start_date
):
    """Test that next_start_date is correctly set from the next_run (future runs only)"""
    course = LearningResourceFactory.create(is_course=True, published=True, runs=[])

    now = now_in_utc()
    future_start = now + timedelta(days=30)
    future_enrollment_start = now + timedelta(days=15)

    # Create a run with future dates
    LearningResourceRunFactory.create(
        learning_resource=course,
        published=True,
        start_date=future_start if has_start_date else None,
        enrollment_start=future_enrollment_start if has_enrollment_start else None,
    )

    # Call load_run_dependent_values
    result = load_run_dependent_values(course)

    # Refresh course from database
    course.refresh_from_db()

    # Verify that next_start_date is set correctly
    if expect_next_start_date:
        # next_start_date should be the max of start_date and enrollment_start
        expected_date = max(
            filter(
                None,
                [
                    future_start if has_start_date else None,
                    future_enrollment_start if has_enrollment_start else None,
                ],
            )
        )
        assert result.next_start_date == expected_date
    else:
        # No future dates, so next_start_date should be None
        assert result.next_start_date is None


@pytest.mark.parametrize(
    ("is_scholar_course", "tag_counts", "expected_score"),
    [
        (False, [24, 24, 1, 1, 8, 1, 1], 1.0),
        (False, [24, 0, 0, 0, 0, 0, 0], 0.4),
        (False, [12, 0, 0, 0, 0, 0, 0], 0.2),
        (False, [0, 24, 0, 0, 0, 0, 0], 0.2),
        (False, [0, 0, 1, 0, 0, 0, 0], 0.2),
        (False, [0, 0, 0, 1, 0, 0, 0], 0.2),
        (False, [0, 0, 0, 0, 4, 4, 2], 0.2),
        (False, [0, 0, 0, 0, 2, 2, 1], 0.1),
        (True, [0, 0, 0, 0, 0, 1, 0], 1.0),
    ],
)
def test_calculate_completeness(mocker, is_scholar_course, tag_counts, expected_score):
    """Test that calculate_completeness returns the expected value"""
    mock_index = mocker.patch("learning_resources.etl.loaders.update_index")
    tag_names = [
        "Lecture Videos",
        "Lecture Notes",
        "Exams with Solutions",
        "Exams",
        "Problem Sets with Solutions",
        "Problem Sets",
        "Assignments",
    ]
    resource = LearningResourceFactory.create(
        is_course=True,
        etl_source=ETLSource.ocw.name,
        platform=LearningResourcePlatformFactory.create(code=PlatformType.ocw.name),
        offered_by=LearningResourceOfferorFactory.create(is_ocw=True),
        completeness=1.0,
    )
    run = resource.runs.first()
    if is_scholar_course:
        course = resource.course
        course.course_numbers = [{"value": "scholarly-course-18.01SC"}]
        course.save()
    tags_with_counts = zip(tag_names, tag_counts)
    tags_list = []
    for tag_name, count in tags_with_counts:
        content_tag = LearningResourceContentTagFactory.create(name=tag_name)
        ContentFileFactory.create_batch(count, run=run, content_tags=[content_tag])
        tags_list.extend([[tag_name]] * count)
    assert round(calculate_completeness(run), ndigits=2) == expected_score
    assert (
        round(calculate_completeness(run, content_tags=tags_list), ndigits=2)
        == expected_score
    )
    assert mock_index.call_count == (1 if resource.completeness != 1.0 else 0)


def test_calculate_completeness_with_none_content_tags(mocker):
    """Test that calculate_completeness handles None values in content_tags list"""
    mock_index = mocker.patch("learning_resources.etl.loaders.update_index")
    resource = LearningResourceFactory.create(
        is_course=True,
        etl_source=ETLSource.ocw.name,
        platform=LearningResourcePlatformFactory.create(code=PlatformType.ocw.name),
        offered_by=LearningResourceOfferorFactory.create(is_ocw=True),
        completeness=0.0,
    )
    run = resource.runs.first()

    # Create some content files with tags
    content_tag = LearningResourceContentTagFactory.create(name="Lecture Videos")
    ContentFileFactory.create_batch(12, run=run, content_tags=[content_tag])

    # Test with content_tags list containing None values
    content_tags_with_none = [["Lecture Videos"]] * 12 + [None, None]

    # Should not raise an error and should calculate score based on non-None values
    score = calculate_completeness(run, content_tags=content_tags_with_none)
    assert score == 0.2  # 12 lecture videos / 24 = 0.5 * 0.4 = 0.2
    assert mock_index.call_count == 1


def test_load_content_files_with_none_content_tags(mocker):
    """Test that load_content_files handles None content_tags in source data"""
    course = LearningResourceFactory.create(is_course=True, create_runs=False)
    course_run = LearningResourceRunFactory.create(
        published=True, learning_resource=course
    )

    # Content data with some files having None content_tags
    content_data = [
        {"uid": "file1", "content_tags": ["Lecture Videos"]},
        {"uid": "file2", "content_tags": None},  # None value
        {"uid": "file3", "content_tags": ["Lecture Notes"]},
        {"uid": "file4"},  # Missing content_tags key
    ]

    mock_load_content_file = mocker.patch(
        "learning_resources.etl.loaders.load_content_file",
        side_effect=lambda run, _data: ContentFileFactory.create(run=run).id,
        autospec=True,
    )
    mocker.patch(
        "learning_resources_search.plugins.tasks.index_run_content_files.si",
    )
    mock_calc_score = mocker.patch(
        "learning_resources.etl.loaders.calculate_completeness"
    )

    # Should not raise an error
    result = load_content_files(course_run, content_data, calc_completeness=True)

    assert mock_load_content_file.call_count == len(content_data)
    assert mock_calc_score.call_count == 1
    assert len(result) == len(content_data)

    # Verify content_tags passed to calculate_completeness doesn't contain None
    call_args = mock_calc_score.call_args
    content_tags_arg = call_args.kwargs.get("content_tags")
    # All None values should have been converted to empty lists
    assert all(tags == [] or isinstance(tags, list) for tags in content_tags_arg)


def test_course_with_unpublished_force_ingest_is_test_mode():
    """
    Test that a course with force_ingest set to True
    and published set to False is marked as a test mode course
    """
    platform = LearningResourcePlatformFactory.create()
    course_data = {
        "readable_id": "testid",
        "platform": platform.code,
        "professional": True,
        "title": "test",
        "image": {"url": "http://test.com"},
        "description": "test",
        "force_ingest": True,
        "url": "http://test.com",
        "published": False,
        "departments": [],
        "runs": [
            {
                "run_id": "test-run",
                "enrollment_start": "2017-01-01T00:00:00Z",
                "start_date": "2017-01-20T00:00:00Z",
                "end_date": "2017-06-20T00:00:00Z",
            }
        ],
    }
    course = load_course(course_data, [], [])
    assert course.require_summaries is True
    assert course.test_mode is True
    assert course.published is False


@pytest.mark.django_db
def test_load_articles(mocker, climate_platform, mock_get_similar_topics_qdrant):
    articles_data = [
        {
            "title": "test",
            "readable_id": "test-article",
            "url": "",
            "description": "summary",
            "topics": [],
            "full_description": "",
            "image": {"url": "http://test.com"},
            "published": True,
            "etl_source": ETLSource.mit_climate.name,
            "offered_by": {
                "code": OfferedBy.climate.name,
            },
        }
    ]
    unpublished_article = ArticleFactory.create()
    mock_bulk_unpublish = mocker.patch(
        "learning_resources.etl.loaders.bulk_resources_unpublished_actions",
        autospec=True,
    )
    result = loaders.load_articles(articles_data)

    assert result[0].title == articles_data[0]["title"]

    # Ensure unpublished articles are handled
    assert (
        mock_bulk_unpublish.mock_calls[0].args[0][0]
        == unpublished_article.learning_resource.id
    )
    assert (
        mock_bulk_unpublish.mock_calls[0].args[1] == LearningResourceType.article.name
    )


@pytest.mark.django_db
def test_load_learning_materials(mocker):
    """
    Test that load_learning_materials runs load_learning_material
    if a ocw content file has content_tags in OCW_COURSE_CONTENT_CATEGORY_MAPPING
    """

    ocw = LearningResourcePlatformFactory.create(code=PlatformType.ocw.name)
    ocw_course = CourseFactory.create(
        platform=ocw.code,
        learning_resource__is_course=True,
    )

    relevant_content_tag = LearningResourceContentTagFactory.create(
        name="Programming Assignments"
    )
    irrelevant_content_tag = LearningResourceContentTagFactory.create(name="Syllabus")

    learning_material_content_file = ContentFileFactory.create(
        run=ocw_course.learning_resource.runs.first(),
        content_tags=[relevant_content_tag],
    )

    other_content_file = ContentFileFactory.create(
        run=ocw_course.learning_resource.runs.first(),
        content_tags=[irrelevant_content_tag],
    )

    load_learning_materials_spy = mocker.spy(loaders, "load_learning_material")

    loaders.load_learning_materials(
        course_run=ocw_course.learning_resource.runs.first(),
        content_file_ids=[
            learning_material_content_file.id,
            other_content_file.id,
        ],
    )

    assert load_learning_materials_spy.call_count == 1
    load_learning_materials_spy.assert_called_with(
        ocw_course.learning_resource.runs.first(),
        learning_material_content_file,
        {"Programming Assignments"},
    )

    learning_material_content_file.refresh_from_db()

    learning_material = learning_material_content_file.learning_material_resource

    resource_relationships = ocw_course.learning_resource.children.all()

    assert resource_relationships.count() == 1

    assert resource_relationships.first().child.id == learning_material.id
    assert (
        resource_relationships.first().relation_type
        == LearningResourceRelationTypes.COURSE_LEARNING_MATERIALS.value
    )


@pytest.mark.django_db
@pytest.mark.parametrize("learning_material_exists", [True, False])
def test_load_learning_material(mocker, learning_material_exists):
    """
    Test that load_learning_material creates a LearningMaterial
    for the given content file and links it to the course run
    """

    ocw = LearningResourcePlatformFactory.create(code=PlatformType.ocw.name)
    ocw_course = CourseFactory.create(
        platform=ocw.code,
        learning_resource__is_course=True,
    )

    content_tag = LearningResourceContentTagFactory.create(
        name="Programming Assignments"
    )

    content_file = ContentFileFactory.create(
        run=ocw_course.learning_resource.runs.first(),
        content_tags=[content_tag],
    )

    if learning_material_exists:
        existing_learning_material = LearningResourceFactory.create()

        existing_learning_material.readable_id = (
            f"{ocw_course.learning_resource.runs.first().run_id}-{content_file.key}"
        )
        existing_learning_material.platform = ocw_course.learning_resource.platform
        existing_learning_material.save()

        content_file.learning_material_resource = existing_learning_material
        content_file.save()

    loaders.load_learning_material(
        ocw_course.learning_resource.runs.first(),
        content_file,
        {"Programming Assignments"},
    )

    assert (
        LearningResource.objects.filter(
            resource_type=LearningResourceType.document.name
        ).count()
        == 1
    )

    learning_material = LearningResource.objects.filter(
        resource_type=LearningResourceType.document.name
    ).last()

    assert learning_material.title == content_file.title
    assert learning_material.url == content_file.url

    assert content_file.learning_material_resource_id == learning_material.id
