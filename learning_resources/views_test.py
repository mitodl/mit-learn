"""Test for learning_resources views"""

import random
from datetime import timedelta

import pytest
from django.contrib.auth.models import Group
from django.utils import timezone
from opensearch_dsl import response
from qdrant_client import QdrantClient
from rest_framework.reverse import reverse

from channels.factories import ChannelTopicDetailFactory, ChannelUnitDetailFactory
from channels.models import Channel
from learning_resources.constants import (
    GROUP_CONTENT_FILE_CONTENT_VIEWERS,
    GROUP_TUTOR_PROBLEM_VIEWERS,
    LearningResourceRelationTypes,
    LearningResourceType,
    OfferedBy,
    PlatformType,
)
from learning_resources.exceptions import WebhookException
from learning_resources.factories import (
    ContentFileFactory,
    CourseFactory,
    LearningResourceDepartmentFactory,
    LearningResourceFactory,
    LearningResourceOfferorFactory,
    LearningResourcePlatformFactory,
    LearningResourceRunFactory,
    LearningResourceTopicFactory,
    LearningResourceViewEventFactory,
    PodcastEpisodeFactory,
    PodcastFactory,
    ProgramFactory,
    TutorProblemFileFactory,
    VideoFactory,
    VideoPlaylistFactory,
)
from learning_resources.models import (
    LearningResourceOfferor,
    LearningResourceRelationship,
    PodcastEpisode,
)
from learning_resources.serializers import (
    ContentFileSerializer,
    LearningResourceDepartmentSerializer,
    LearningResourceDisplayInfoResponseSerializer,
    LearningResourceOfferorDetailSerializer,
    LearningResourcePlatformSerializer,
    LearningResourceTopicSerializer,
    PodcastEpisodeSerializer,
    PodcastSerializer,
    VideoPlaylistSerializer,
    VideoResourceSerializer,
    VideoSerializer,
)
from learning_resources.views import LearningResourceViewSet
from learning_resources_search.api import Search
from learning_resources_search.serializers import serialize_learning_resource_for_update
from main.test_utils import assert_json_equal

pytestmark = [pytest.mark.django_db]


@pytest.mark.parametrize(
    ("url", "params"),
    [
        ("lr:v1:courses_api-list", ""),
        ("lr:v1:learning_resources_api-list", "resource_type=course"),
    ],
)
def test_list_course_endpoint(client, url, params):
    """Test courses endpoint"""
    courses = sorted(
        CourseFactory.create_batch(2), key=lambda course: course.learning_resource.id
    )
    # this should be filtered out
    CourseFactory.create_batch(5, is_unpublished=True)

    resp = client.get(f"{reverse(url)}?{params}")
    assert resp.data.get("count") == 2
    for course in resp.data.get("results"):
        assert course.get("id") in [c.learning_resource.id for c in courses]
        assert len(course.get("runs")) > 1
        for i in range(1, len(course.get("runs"))):
            assert (
                course.get("runs")[i]["start_date"]
                >= course.get("runs")[i - 1]["start_date"]
            )


@pytest.mark.parametrize(
    "url", ["lr:v1:courses_api-detail", "lr:v1:learning_resources_api-detail"]
)
def test_get_course_detail_endpoint(client, url):
    """Test course detail endpoint"""
    course = CourseFactory.create()

    resp = client.get(reverse(url, args=[course.learning_resource.id]))

    assert resp.data.get("readable_id") == course.learning_resource.readable_id
    assert len(resp.data.get("runs")) > 1
    assert [run["id"] for run in resp.data.get("runs")] == list(
        course.learning_resource.runs.values_list("id", flat=True).order_by(
            "start_date"
        )
    )
    for i in range(1, len(resp.data.get("runs"))):
        assert (
            resp.data.get("runs")[i]["start_date"]
            >= resp.data.get("runs")[i - 1]["start_date"]
        )


@pytest.mark.skip_nplusone_check
@pytest.mark.parametrize(
    "url",
    [
        "lr:v1:learning_resource_content_files_api-list",
        "lr:v1:course_content_files_api-list",
    ],
)
def test_get_course_content_files_endpoint(client, url):
    """Test course detail contentfiles endpoint"""
    course = CourseFactory.create()
    content_files = sorted(
        ContentFileFactory.create_batch(17, run=course.learning_resource.runs.first()),
        key=lambda content_file: content_file.created_on,
        reverse=True,
    )
    ContentFileFactory.create(
        run=course.learning_resource.runs.first(), published=False
    )

    resp = client.get(reverse(url, args=[course.learning_resource.id]))

    assert resp.data.get("count") == 17
    for idx, content_file in enumerate(content_files[:10]):
        assert resp.data.get("results")[idx]["id"] == content_file.id


@pytest.mark.skip_nplusone_check
@pytest.mark.parametrize(
    ("reverse_url", "expected_url"),
    [
        (
            "lr:v1:learning_resource_content_files_api-list",
            "/api/v1/learning_resources/{}/contentfiles/",
        ),
        ("lr:v1:course_content_files_api-list", "/api/v1/courses/{}/contentfiles/"),
    ],
)
def test_get_course_content_files_filtered(client, reverse_url, expected_url):
    """Test course detail contentfiles endpoint"""
    course = CourseFactory.create()
    ContentFileFactory.create_batch(2, run=course.learning_resource.runs.first())
    ContentFileFactory.create_batch(3, run=course.learning_resource.runs.last())

    expected_url = expected_url.format(course.learning_resource.id)
    assert reverse(reverse_url, args=[course.learning_resource.id]) == expected_url

    resp = client.get(
        f"{expected_url}?run_id={course.learning_resource.runs.first().id}"
    )
    assert resp.data.get("count") == 2

    resp = client.get(
        f"{expected_url}?run_id={course.learning_resource.runs.last().id}"
    )
    assert resp.data.get("count") == 3


@pytest.mark.parametrize(
    ("url", "params"),
    [
        ("lr:v1:programs_api-list", ""),
        ("lr:v1:learning_resources_api-list", "resource_type=program"),
    ],
)
def test_program_endpoint(client, url, params):
    """Test program endpoint"""
    programs = ProgramFactory.create_batch(3)

    resp = client.get(f"{reverse(url)}?{params}")
    for i in range(3):
        assert resp.data.get("results")[i]["id"] == programs[i].learning_resource.id


@pytest.mark.parametrize(
    "url", ["lr:v1:programs_api-detail", "lr:v1:learning_resources_api-detail"]
)
def test_program_detail_endpoint(client, django_assert_num_queries, url):
    """Test program endpoint"""
    program = ProgramFactory.create()
    assert program.learning_resource.children.count() > 0
    with django_assert_num_queries(22):  # should be same # regardless of child count
        resp = client.get(reverse(url, args=[program.learning_resource.id]))
    assert resp.data.get("title") == program.learning_resource.title
    assert resp.data.get("resource_type") == LearningResourceType.program.name
    assert (
        resp.data["program"]["course_count"]
        == program.learning_resource.children.count()
    )


def test_list_resources_endpoint(client):
    """Test unfiltered learning_resources endpoint"""
    courses = CourseFactory.create_batch(2)
    programs = ProgramFactory.create_batch(2)
    resource_ids = [resource.learning_resource.id for resource in [*courses, *programs]]
    resource_ids.extend(
        [
            course.child.id
            for sublist in [program.courses.all() for program in programs]
            for course in sublist
        ]
    )

    # this should be filtered out
    CourseFactory.create(is_unpublished=True)

    resp = client.get(reverse("lr:v1:learning_resources_api-list"))
    assert resp.data.get("count") == len(set(resource_ids))
    for result in resp.data["results"]:
        assert result["id"] in resource_ids


@pytest.mark.parametrize("course_count", [1, 5, 20])
def test_no_excess_queries(rf, user, mocker, django_assert_num_queries, course_count):
    """
    There should be a constant number of queries made (based on number of
    related models), regardless of number of results returned.
    """
    from learning_resources.views import CourseViewSet

    CourseFactory.create_batch(course_count)

    request = rf.get("/")
    request.user = user

    with django_assert_num_queries(22):
        view = CourseViewSet(request=request)
        results = view.get_queryset().all()
        assert len(results) == course_count


@pytest.mark.parametrize("offeror_count", [1, 2, 4])
def test_no_excess_offeror_queries(client, django_assert_num_queries, offeror_count):
    """
    There should be a constant number of queries made (based on number of
    related models), regardless of number of offeror results returned.
    """
    for offeror_code in OfferedBy.names()[:offeror_count]:
        ChannelUnitDetailFactory.create(
            unit=LearningResourceOfferorFactory.create(code=offeror_code)
        )

    assert LearningResourceOfferor.objects.count() == offeror_count
    assert Channel.objects.count() == offeror_count

    with django_assert_num_queries(2):
        results = client.get(reverse("lr:v1:offerors_api-list"))
        assert len(results.data["results"]) == offeror_count
        for result in results.data["results"]:
            assert result["channel_url"] is not None


@pytest.mark.skip_nplusone_check
@pytest.mark.parametrize(
    "user_role",
    [
        "anonymous",
        "normal",
        "admin",
        "group_content_file_content_viewer",
    ],
)
def test_list_content_files_list_endpoint(client, user_role, django_user_model):
    """Test ContentFile list endpoint"""
    course = CourseFactory.create()
    content_file_ids = [
        cf.id
        for cf in ContentFileFactory.create_batch(
            2, run=course.learning_resource.runs.first(), content="some content"
        )
    ]
    # this should be filtered out
    ContentFileFactory.create_batch(5, published=False, content="some content")
    if user_role == "admin":
        admin_user = django_user_model.objects.create_superuser(
            "admin", "admin@example.com", "pass"
        )
        client.force_login(admin_user)
    elif user_role == "group_content_file_content_viewer":
        user = django_user_model.objects.create()
        group, _ = Group.objects.get_or_create(name=GROUP_CONTENT_FILE_CONTENT_VIEWERS)
        group.user_set.add(user)
        client.force_login(user)
    elif user_role == "normal":
        user = django_user_model.objects.create()
        client.force_login(user)

    assert reverse("lr:v1:contentfiles_api-list") == "/api/v1/contentfiles/"

    resp = client.get(f"{reverse('lr:v1:contentfiles_api-list')}")
    assert resp.data.get("count") == 2
    for result in resp.data.get("results"):
        assert result["id"] in content_file_ids

        if user_role in ["admin", "group_content_file_content_viewer"]:
            assert result["content"] is not None
        else:
            assert result.get("content") is None


@pytest.mark.skip_nplusone_check
def test_list_content_files_list_endpoint_with_no_runs(client):
    """Test ContentFile list endpoint returns results even without associated runs"""
    course = CourseFactory.create()
    content_file_ids = [
        cf.id
        for cf in ContentFileFactory.create_batch(
            5, learning_resource=course.learning_resource
        )
    ]

    assert reverse("lr:v1:contentfiles_api-list") == "/api/v1/contentfiles/"

    resp = client.get(f"{reverse('lr:v1:contentfiles_api-list')}")

    assert resp.data.get("count") == 5
    for result in resp.data.get("results"):
        assert result["id"] in content_file_ids


@pytest.mark.skip_nplusone_check
def test_list_content_files_list_filtered(client):
    """Test ContentFile list endpoint"""
    course_1 = CourseFactory.create()
    ContentFileFactory.create_batch(2, run=course_1.learning_resource.runs.first())
    course_2 = CourseFactory.create()
    ContentFileFactory.create_batch(3, run=course_2.learning_resource.runs.first())

    resp = client.get(
        f"{reverse('lr:v1:contentfiles_api-list')}?run_id={course_1.learning_resource.runs.first().id}"
    )
    assert resp.data.get("count") == 2
    resp = client.get(
        f"{reverse('lr:v1:contentfiles_api-list')}?resource_id={course_2.learning_resource.id}"
    )
    assert resp.data.get("count") == 3
    resp = client.get(f"{reverse('lr:v1:contentfiles_api-list')}?resource_id=1001001")
    assert resp.data.get("count") == 0


@pytest.mark.parametrize(
    "user_role",
    [
        "anonymous",
        "normal",
        "admin",
        "group_content_file_content_viewer",
    ],
)
def test_get_contentfiles_detail_endpoint(client, user_role, django_user_model):
    """Test ContentFile detail endpoint"""
    content_file = ContentFileFactory.create()

    if user_role == "admin":
        admin_user = django_user_model.objects.create_superuser(
            "admin", "admin@example.com", "pass"
        )
        client.force_login(admin_user)
    elif user_role == "group_content_file_content_viewer":
        user = django_user_model.objects.create()
        group, _ = Group.objects.get_or_create(name=GROUP_CONTENT_FILE_CONTENT_VIEWERS)
        group.user_set.add(user)
        client.force_login(user)
    elif user_role == "normal":
        user = django_user_model.objects.create()
        client.force_login(user)

    url = reverse("lr:v1:contentfiles_api-detail", args=[content_file.id])
    assert url == f"/api/v1/contentfiles/{content_file.id}/"

    resp = client.get(url)
    if user_role in ["admin", "group_content_file_content_viewer"]:
        assert resp.data == ContentFileSerializer(instance=content_file).data
    else:
        data = ContentFileSerializer(instance=content_file).data
        data.pop("content")
        assert resp.data == data


@pytest.mark.parametrize(
    ("url", "params"),
    [
        ("lr:v1:podcasts_api-list", ""),
        ("lr:v1:learning_resources_api-list", "resource_type=podcast"),
    ],
)
def test_list_podcast_endpoint(client, url, params):
    """Test podcast endpoint"""
    podcasts = sorted(
        PodcastFactory.create_batch(2), key=lambda podcast: podcast.learning_resource.id
    )
    # this should be filtered out
    PodcastFactory.create_batch(5, is_unpublished=True)

    resp = client.get(f"{reverse(url)}?{params}")
    assert resp.data.get("count") == 2

    for idx, podcast in enumerate(podcasts):
        assert resp.data.get("results")[idx]["id"] == podcast.learning_resource.id
        assert (
            resp.data.get("results")[idx]["podcast"]
            == PodcastSerializer(instance=podcast).data
        )


@pytest.mark.parametrize(
    "url", ["lr:v1:podcasts_api-detail", "lr:v1:learning_resources_api-detail"]
)
def test_get_podcast_detail_endpoint(client, url):
    """Test podcast detail endpoint"""
    podcast = PodcastFactory.create()

    resp = client.get(reverse(url, args=[podcast.learning_resource.id]))

    assert resp.data.get("readable_id") == podcast.learning_resource.readable_id
    assert resp.data.get("podcast") == PodcastSerializer(instance=podcast).data


@pytest.mark.parametrize(
    ("url", "params"),
    [
        ("lr:v1:podcast_episodes_api-list", "sortby=-last_modified"),
        (
            "lr:v1:learning_resources_api-list",
            "resource_type=podcast_episode&sortby=-last_modified",
        ),
    ],
)
def test_list_podcast_episode_endpoint(client, url, params):
    """Test podcast episode endpoint"""
    podcast = PodcastFactory.create().learning_resource

    # this should be filtered out
    podcast.resources.add(
        PodcastEpisodeFactory.create(is_unpublished=True).learning_resource,
        through_defaults={
            "relation_type": LearningResourceRelationTypes.PODCAST_EPISODES.value
        },
    )

    resp = client.get(f"{reverse(url)}?{params}")
    assert resp.data.get("count") == podcast.resources.count() - 1

    for idx, episode in enumerate(
        sorted(
            podcast.resources.filter(published=True),
            key=lambda episode: episode.last_modified,
            reverse=True,
        )
    ):
        assert resp.data.get("results")[idx]["id"] == episode.id
        assert (
            resp.data.get("results")[idx]["podcast_episode"]
            == PodcastEpisodeSerializer(instance=episode.podcast_episode).data
        )


@pytest.mark.parametrize(
    ("url", "params"),
    [
        ("lr:v1:podcast_episodes_api-list", "sortby=-last_modified"),
        ("lr:v1:learning_resources_api-list", "resource_type=podcast_episode"),
    ],
)
def test_list_podcast_episode_endpoint_returns_podcast(client, url, params):
    """Test podcast episode endpoint returns podcast ids"""
    podcast = PodcastFactory.create().learning_resource
    PodcastEpisodeFactory.create_batch(2)
    episodes = PodcastEpisode.objects.all()
    podcast.resources.set(
        [episode.learning_resource for episode in episodes],
        through_defaults={
            "relation_type": LearningResourceRelationTypes.PODCAST_EPISODES.value
        },
    )
    resp = client.get(f"{reverse(url)}?{params}")
    for item in resp.data["results"]:
        assert podcast.id in item["podcast_episode"]["podcasts"]


@pytest.mark.parametrize(
    "url", ["lr:v1:podcast_episodes_api-detail", "lr:v1:learning_resources_api-detail"]
)
def test_get_podcast_episode_detail_endpoint(client, url):
    """Test podcast episode detail endpoint"""
    episode = PodcastEpisodeFactory.create()

    resp = client.get(reverse(url, args=[episode.learning_resource.id]))

    assert resp.data.get("readable_id") == episode.learning_resource.readable_id
    assert (
        resp.data.get("podcast_episode")
        == PodcastEpisodeSerializer(instance=episode).data
    )


@pytest.mark.skip_nplusone_check
@pytest.mark.parametrize(
    "url", ["lr:v1:learning_resource_items_api-list", "lr:v1:podcast_items_api-list"]
)
def test_get_podcast_items_endpoint(client, url):
    """Test podcast items endpoint"""
    podcast = PodcastFactory.create()

    # this should be filtered out
    podcast.learning_resource.resources.add(
        PodcastEpisodeFactory.create(is_unpublished=True).learning_resource,
        through_defaults={
            "relation_type": LearningResourceRelationTypes.PODCAST_EPISODES.value
        },
    )

    resp = client.get(reverse(url, args=[podcast.learning_resource.id]))

    assert resp.data.get("count") == podcast.learning_resource.resources.count() - 1

    for idx, resource_relationship in enumerate(
        sorted(
            LearningResourceRelationship.objects.filter(
                parent_id=podcast.id, child__published=True
            ),
            key=lambda item: item.child.last_modified,
            reverse=True,
        )
    ):
        assert resp.data.get("results")[idx]["id"] == resource_relationship.id
        assert (
            resp.data.get("results")[idx]["resource"]
            == PodcastEpisodeSerializer(instance=resource_relationship.child).data
        )


@pytest.mark.parametrize(
    "data",
    [
        {"webhook_key": "fake_key", "prefix": "prefix1", "version": "live"},
        {"webhook_key": "fake_key", "prefix": "prefix2", "version": "draft"},
        {"webhook_key": "fake_key", "prefixes": "prefix1, prefix2", "version": "live"},
        {
            "webhook_key": "fake_key",
            "prefixes": ["prefix1", "prefix2"],
            "version": "live",
        },
        {"webhook_key": "fake_key", "version": "live"},
    ],
)
def test_ocw_webhook_endpoint(client, mocker, settings, data):
    """Test that the OCW webhook endpoint schedules a get_ocw_courses task"""
    settings.OCW_WEBHOOK_KEY = "fake_key"
    mock_get_ocw = mocker.patch(
        "learning_resources.views.get_ocw_courses.delay", autospec=True
    )
    assert reverse("lr:v1:ocw-next-webhook") == "/api/v1/ocw_next_webhook/"
    response = client.post(
        reverse("lr:v1:ocw-next-webhook"),
        data=data,
        headers={"Content-Type": "text/plain"},
    )

    prefix = data.get("prefix")
    prefixes = data.get("prefixes")

    expected_prefixes = [prefix] if prefix else prefixes
    if isinstance(expected_prefixes, str):
        expected_prefixes = [prefix.strip() for prefix in expected_prefixes.split(",")]

    if expected_prefixes and data.get("version") == "live":
        mock_get_ocw.assert_called_once_with(
            url_paths=expected_prefixes, force_overwrite=False
        )
        assert response.status_code == 200
        assert (
            response.data["message"]
            == f"OCW courses queued for indexing: {expected_prefixes}"
        )
    else:
        mock_get_ocw.assert_not_called()
        if data.get("version") != "live":
            assert response.data["message"] == "Not a live version, ignoring"
            assert response.status_code == 200
        else:
            assert (
                response.data["message"]
                == f"Could not determine appropriate action from request: {data}"
            )
            assert response.status_code == 400


@pytest.mark.parametrize(
    "data",
    [
        {"site_uid": "254605fe779d5edd86f55a421e82b544", "version": "live"},
        {
            "site_uid": "254605fe779d5edd86f55a421e82b544",
            "version": "live",
            "unpublished": True,
        },
        {
            "site_uid": "254605fe779d5edd86f55a421e82b544",
            "version": "draft",
            "unpublished": True,
        },
        {"site_uid": None, "version": "live", "unpublished": True},
    ],
)
@pytest.mark.parametrize("run_exists", [True, False])
def test_ocw_webhook_endpoint_unpublished(client, mocker, settings, data, run_exists):
    """Test that the OCW webhook endpoint removes an unpublished task from the search index"""
    settings.OCW_WEBHOOK_KEY = "fake_key"
    mock_delete_course = mocker.patch(
        "learning_resources.views.resource_unpublished_actions", autospec=True
    )
    run_id = data.get("site_uid")
    course_run = None
    if run_id and run_exists:
        course_run = LearningResourceRunFactory.create(
            run_id=run_id,
            learning_resource=CourseFactory.create(
                platform=PlatformType.ocw.name
            ).learning_resource,
        )
    response = client.post(
        reverse("lr:v1:ocw-next-webhook"),
        data={"webhook_key": "fake_key", **data},
        headers={"Content-Type": "text/plain"},
    )

    if (
        data.get("site_uid")
        and data.get("unpublished") is True
        and data.get("version") == "live"
    ):
        assert response.status_code == 200
        if run_exists:
            mock_delete_course.assert_called_once_with(course_run.learning_resource)
            assert (
                response.data["message"]
                == f"OCW course {run_id} queued for unpublishing"
            )
        else:
            assert (
                response.data["message"]
                == f"OCW course {run_id} not found, so nothing to unpublish"
            )
    else:
        mock_delete_course.assert_not_called()


def test_ocw_webhook_endpoint_bad_key(settings, client):
    """Test that a webhook exception is raised if a bad key is sent"""
    settings.OCW_WEBHOOK_KEY = "fake_key"
    with pytest.raises(WebhookException):
        client.post(
            reverse("lr:v1:ocw-next-webhook"),
            data={"webhook_key": "bad_key", "prefix": "prefix", "version": "live"},
            headers={"Content-Type": "text/plain"},
        )


def test_topics_list_endpoint(client, django_assert_num_queries):
    """Test topics list endpoint"""
    topics = sorted(
        LearningResourceTopicFactory.create_batch(100),
        key=lambda topic: topic.name,
    )
    for topic in topics:
        ChannelTopicDetailFactory.create(topic=topic)

    with django_assert_num_queries(2):
        resp = client.get(reverse("lr:v1:topics_api-list"))

    assert resp.data == {
        "count": 100,
        "next": None,
        "previous": None,
        "results": [
            LearningResourceTopicSerializer(instance=topic).data for topic in topics
        ],
    }


def test_topics_detail_endpoint(client):
    """Test topics detail endpoint"""
    topic = LearningResourceTopicFactory.create()
    ChannelTopicDetailFactory.create(topic=topic)
    resp = client.get(reverse("lr:v1:topics_api-detail", args=[topic.pk]))
    assert resp.data == LearningResourceTopicSerializer(instance=topic).data


@pytest.mark.parametrize("published", [True, False])
def test_topic_channel_url(client, published):
    """
    Test that topics with published channels return the channel_url,
    and unpublished channels are not included in the response
    """
    topic = LearningResourceTopicFactory.create()
    channel = ChannelTopicDetailFactory.create(
        topic=topic, is_unpublished=not published
    ).channel
    resp = client.get(reverse("lr:v1:topics_api-detail", args=[topic.pk]))

    if published:
        assert resp.data["channel_url"] == channel.channel_url
    else:
        assert resp.status_code == 404


def test_departments_list_endpoint(client):
    """Test departments list endpoint"""
    departments = sorted(
        LearningResourceDepartmentFactory.create_batch(3),
        key=lambda department: department.department_id,
    )

    resp = client.get(reverse("lr:v1:departments_api-list"))
    assert resp.data.get("count") == 3
    for i in range(3):
        assert (
            resp.data.get("results")[i]
            == LearningResourceDepartmentSerializer(instance=departments[i]).data
        )


def test_departments_detail_endpoint(client):
    """Test departments detail endpoint"""
    department = LearningResourceDepartmentFactory.create(
        department_id="ABC", name="Alpha Beta Charlie"
    )

    for dept_id in ("abc", "aBc", "ABC"):
        resp = client.get(reverse("lr:v1:departments_api-detail", args=[dept_id]))
        assert (
            resp.data == LearningResourceDepartmentSerializer(instance=department).data
        )


def test_schools_list_endpoint(client):
    """Test schools list endpoint"""
    schools = sorted(
        [dept.school for dept in LearningResourceDepartmentFactory.create_batch(3)],
        key=lambda school: school.id,
    )

    resp = client.get(reverse("lr:v1:schools_api-list"))
    assert resp.data.get("count") == 3
    for i in range(3):
        assert resp.data.get("results")[i] == {
            "id": schools[i].id,
            "name": schools[i].name,
            "url": schools[i].url,
            "departments": [
                {
                    "department_id": dept.department_id,
                    "name": dept.name,
                    "channel_url": None,
                }
                for dept in schools[i].departments.all().order_by("department_id")
            ],
        }


def test_schools_detail_endpoint(client):
    """Test schools detail endpoint"""
    department = LearningResourceDepartmentFactory.create(
        department_id="ABC", name="Alpha Beta Charlie"
    )

    for dept_id in ("abc", "aBc", "ABC"):
        resp = client.get(reverse("lr:v1:departments_api-detail", args=[dept_id]))
        assert (
            resp.data == LearningResourceDepartmentSerializer(instance=department).data
        )


def test_platforms_list_endpoint(client):
    """Test platforms list endpoint"""
    platforms = sorted(
        [
            LearningResourcePlatformFactory.create(code=code)
            for code in PlatformType.names()
        ],
        key=lambda platform: platform.code,
    )

    resp = client.get(reverse("lr:v1:platforms_api-list"))
    assert resp.data.get("count") == len(platforms)
    for i in range(3):
        assert (
            resp.data.get("results")[i]
            == LearningResourcePlatformSerializer(instance=platforms[i]).data
        )


def test_platforms_detail_endpoint(client):
    """Test platforms detail endpoint"""
    platform = LearningResourcePlatformFactory.create()

    resp = client.get(reverse("lr:v1:platforms_api-detail", args=[platform.pk]))
    assert resp.data == LearningResourcePlatformSerializer(instance=platform).data


def test_offerors_list_endpoint(client):
    """Test offerors list endpoint"""
    offerors = sorted(
        [
            LearningResourceOfferorFactory.create(code=code)
            for code in OfferedBy.names()
        ],
        key=lambda offeror: offeror.code,
    )

    resp = client.get(reverse("lr:v1:offerors_api-list"))
    assert resp.data.get("count") == len(offerors)
    for i in range(3):
        assert (
            resp.data.get("results")[i]
            == LearningResourceOfferorDetailSerializer(instance=offerors[i]).data
        )


def test_offerors_detail_endpoint(client):
    """Test offerors detail endpoint"""
    offeror = LearningResourceOfferorFactory.create()

    resp = client.get(reverse("lr:v1:offerors_api-detail", args=[offeror.code]))
    assert resp.data == LearningResourceOfferorDetailSerializer(instance=offeror).data


@pytest.mark.skip_nplusone_check
@pytest.mark.parametrize(
    ("url", "params"),
    [
        ("lr:v1:video_playlists_api-list", ""),
        ("lr:v1:learning_resources_api-list", "resource_type=video_playlist"),
    ],
)
def test_list_video_playlist_endpoint(client, url, params):
    """Test video playlist endpoint"""
    playlists = sorted(
        VideoPlaylistFactory.create_batch(2), key=lambda resource: resource.id
    )

    # this should be filtered out
    VideoPlaylistFactory.create_batch(5, is_unpublished=True)

    resp = client.get(f"{reverse(url)}?{params}")
    assert resp.data.get("count") == 2

    for idx, playlist in enumerate(playlists):
        assert resp.data.get("results")[idx]["id"] == playlist.learning_resource.id
        assert (
            resp.data.get("results")[idx]["video_playlist"]
            == VideoPlaylistSerializer(instance=playlist).data
        )


@pytest.mark.parametrize(
    "url", ["lr:v1:video_playlists_api-detail", "lr:v1:learning_resources_api-detail"]
)
def test_get_video_playlist_detail_endpoint(client, url):
    """Test video playlist detail endpoint"""
    playlist = VideoPlaylistFactory.create()

    resp = client.get(reverse(url, args=[playlist.learning_resource.id]))

    assert resp.data.get("readable_id") == playlist.learning_resource.readable_id
    assert (
        resp.data.get("video_playlist")
        == VideoPlaylistSerializer(instance=playlist).data
    )


@pytest.mark.skip_nplusone_check
@pytest.mark.parametrize(
    "url",
    ["lr:v1:learning_resource_items_api-list", "lr:v1:video_playlist_items_api-list"],
)
def test_get_video_playlist_items_endpoint(client, url):
    """Test video playlist items endpoint"""
    playlist = VideoPlaylistFactory.create().learning_resource
    videos = VideoFactory.create_batch(2)
    playlist.resources.set(
        [video.learning_resource for video in videos],
        through_defaults={
            "relation_type": LearningResourceRelationTypes.PLAYLIST_VIDEOS
        },
    )
    assert playlist.resources.count() > 0

    # this should be filtered out
    playlist.resources.add(
        VideoFactory.create(is_unpublished=True).learning_resource,
        through_defaults={
            "relation_type": LearningResourceRelationTypes.PLAYLIST_VIDEOS.value
        },
    )

    resp = client.get(reverse(url, args=[playlist.id]))

    assert resp.data.get("count") == playlist.resources.count() - 1

    for idx, resource_relationship in enumerate(
        sorted(
            LearningResourceRelationship.objects.filter(
                parent_id=playlist.id, child__published=True
            ),
            key=lambda item: item.child.last_modified,
            reverse=True,
        )
    ):
        assert resp.data.get("results")[idx]["id"] == resource_relationship.id
        assert (
            resp.data.get("results")[idx]["resource"]
            == VideoResourceSerializer(instance=resource_relationship.child).data
        )


@pytest.mark.skip_nplusone_check
@pytest.mark.parametrize(
    ("url", "params"),
    [
        ("lr:v1:videos_api-list", ""),
        ("lr:v1:learning_resources_api-list", "resource_type=video"),
    ],
)
def test_list_video_endpoint(client, url, params):
    """Test video endpoint"""
    videos = sorted(VideoFactory.create_batch(2), key=lambda resource: resource.id)

    # this should be filtered out
    VideoFactory.create_batch(5, is_unpublished=True)

    resp = client.get(f"{reverse(url)}?{params}")
    assert resp.data.get("count") == 2

    for idx, video in enumerate(videos):
        assert resp.data.get("results")[idx]["id"] == video.learning_resource.id
        assert (
            resp.data.get("results")[idx]["video"]
            == VideoSerializer(instance=video).data
        )


@pytest.mark.skip_nplusone_check
@pytest.mark.parametrize(
    ("url", "params"),
    [
        ("lr:v1:videos_api-list", ""),
        ("lr:v1:learning_resources_api-list", "resource_type=video"),
    ],
)
def test_list_video_endpoint_returns_playlists(client, url, params):
    """Test video endpoint returns playlist ids"""

    playlist = VideoPlaylistFactory.create().learning_resource
    videos = VideoFactory.create_batch(2)
    playlist.resources.set(
        [video.learning_resource for video in videos],
        through_defaults={
            "relation_type": LearningResourceRelationTypes.PLAYLIST_VIDEOS
        },
    )
    resp = client.get(f"{reverse(url)}?{params}")
    for item in resp.data["results"]:
        assert playlist.id in item["playlists"]


@pytest.mark.parametrize(
    "url", ["lr:v1:videos_api-detail", "lr:v1:learning_resources_api-detail"]
)
def test_get_video_detail_endpoint(client, url):
    """Test video detail endpoint"""
    video = VideoFactory.create()

    resp = client.get(reverse(url, args=[video.learning_resource.id]))

    assert resp.data.get("readable_id") == video.learning_resource.readable_id
    assert resp.data.get("video") == VideoSerializer(instance=video).data


@pytest.mark.parametrize(
    ("url", "params"),
    [
        ("lr:v1:courses_api-list", "sortby=new"),
        (
            "lr:v1:learning_resources_api-list",
            "sortby=new&resource_type=course",
        ),
    ],
)
def test_sortby_new(client, url, params):
    """Test new courses endpoint"""
    courses = sorted(
        CourseFactory.create_batch(3),
        key=lambda course: course.learning_resource.created_on,
        reverse=True,
    )

    resp = client.get(f"{reverse(url)}?{params}")

    assert resp.data.get("count") == 3
    assert len(resp.data.get("results")) == 3

    for i in range(3):
        assert resp.data.get("results")[i]["id"] == courses[i].learning_resource.id


@pytest.mark.parametrize(
    ("url", "params"),
    [
        ("lr:v1:courses_api-list", "sortby=upcoming"),
        ("lr:v1:learning_resources_api-list", "sortby=upcoming&resource_type=course"),
    ],
)
def test_sortby_upcoming(client, url, params):
    """Test upcoming courses endpoint"""
    other_learning_resource = LearningResourceFactory.create(
        is_course=True, next_start_date=None
    )

    later_upcoming_learning_resource = LearningResourceFactory.create(
        is_course=True, next_start_date=timezone.now() + timedelta(2)
    )

    upcoming_learning_resource = LearningResourceFactory.create(
        is_course=True, next_start_date=timezone.now() + timedelta(1)
    )

    resp = client.get(f"{reverse(url)}?{params}")
    assert resp.data.get("count") == 3
    assert len(resp.data.get("results")) == 3
    assert resp.data.get("results")[0]["id"] == upcoming_learning_resource.id
    assert resp.data.get("results")[1]["id"] == later_upcoming_learning_resource.id
    assert resp.data.get("results")[2]["id"] == other_learning_resource.id


@pytest.mark.parametrize("resource_type", ["course", "program"])
def test_popular_sort(client, resource_type):
    """Test the popular endpoints to ensure they return data correctly."""

    resources = LearningResourceFactory.create_batch(5, resource_type=resource_type)

    for resource in resources:
        LearningResourceViewEventFactory.create_batch(
            random.randrange(0, 30),  # noqa: S311
            learning_resource=resource,
        )

    url = reverse("lr:v1:learning_resources_api-list")

    params = (
        f"resource_type={resource_type}&sortby=-views"
        if resource_type
        else "sortby=-views"
    )

    resp = client.get(f"{url}?{params}")

    assert resp.data.get("count") == 5
    assert len(resp.data.get("results")) == 5

    for i in range(1, 5):
        assert (
            resp.data.get("results")[i - 1]["views"]
            >= resp.data.get("results")[i]["views"]
        )


def test_featured_view(client, offeror_featured_lists):
    """The featured api endpoint should return resources in expected order"""
    url = reverse("lr:v1:featured_api-list")
    resp_1 = client.get(f"{url}?limit=12")
    assert resp_1.data.get("count") == 21
    assert len(resp_1.data.get("results")) == 12

    # Second request should return same resources in different order
    resp_2 = client.get(f"{url}?limit=12")
    resp_1_ids = [resource["id"] for resource in resp_1.data.get("results")]
    resp_2_ids = [resource["id"] for resource in resp_2.data.get("results")]
    assert sorted(resp_1_ids) == sorted(resp_2_ids)

    for resp in [resp_1, resp_2]:
        # Should get 1st resource from every featured list, then 2nd, etc.
        for idx, resource in enumerate(resp.data.get("results")):
            position = int(idx / 7)  # 6 offerors: 0,0,0,0,0,0,1,1,1,1,1,1
            offeror = LearningResourceOfferor.objects.get(
                code=resource["offered_by"]["code"]
            )
            featured_list = Channel.objects.get(unit_detail__unit=offeror).featured_list
            assert featured_list.children.all()[position].child.id == resource["id"]


@pytest.mark.parametrize("parameter", ["certification", "free", "professional"])
def test_featured_view_filter(client, offeror_featured_lists, parameter):
    """The featured api endpoint should return resources that match the filter"""
    url = reverse("lr:v1:featured_api-list")
    resp = client.get(f"{url}?{parameter}=true")
    assert len(resp.data.get("results")) > 0
    for resource in resp.data.get("results"):
        if parameter != "free":
            assert resource[parameter] is True
        else:
            for run in resource["runs"]:
                assert run["prices"] == []
                assert run["resource_prices"] == []


@pytest.mark.skip_nplusone_check
def test_similar_resources_endpoint_does_not_return_self(mocker, client):
    """Test similar learning_resources endpoint does not return initial resource"""
    from learning_resources.models import LearningResource

    resources = LearningResourceFactory.create_batch(5)

    resource_ids = [learning_resource.id for learning_resource in resources]
    mocker.patch.object(Search, "execute")

    Search.execute.return_value = response.Response(
        Search().query(),
        {
            "_shards": {"failed": 0, "successful": 10, "total": 10},
            "hits": {
                "hits": [
                    serialize_learning_resource_for_update(lr)
                    for lr in LearningResource.objects.for_search_serialization().filter(
                        id__in=resource_ids
                    )
                ],
                "max_score": 12.0,
                "total": 123,
            },
            "timed_out": False,
            "took": 123,
        },
    ).hits
    similar_for = resource_ids[0]
    resp = client.get(
        reverse("lr:v1:learning_resources_api-similar", args=[similar_for])
    )
    response_ids = [hit["id"] for hit in resp.json()]
    assert similar_for not in response_ids


@pytest.mark.skip_nplusone_check
def test_similar_resources_endpoint_only_returns_published(mocker, client):
    """Test similar learning_resources endpoint only returns published items"""
    from learning_resources.models import LearningResource

    resources = LearningResourceFactory.create_batch(5)

    resource_ids = [learning_resource.id for learning_resource in resources]
    similar_for = resource_ids.pop()
    mocker.patch.object(Search, "execute")
    response_resources = LearningResource.objects.for_search_serialization().filter(
        id__in=resource_ids
    )
    response_hits = []
    for lr in response_resources:
        serialized_resource = serialize_learning_resource_for_update(lr)
        serialized_resource["published"] = False
        lr.published = False
        lr.save()
        response_hits.append(serialized_resource)
    # set one item to published
    published_resource = response_resources[0]
    published_resource.published = True
    published_resource.save()
    Search.execute.return_value = response.Response(
        Search().query(),
        {
            "_shards": {"failed": 0, "successful": 10, "total": 10},
            "hits": {
                "hits": response_hits,
                "max_score": 12.0,
                "total": 123,
            },
            "timed_out": False,
            "took": 123,
        },
    ).hits
    resp = client.get(
        reverse("lr:v1:learning_resources_api-similar", args=[similar_for])
    )
    response_ids = [hit["id"] for hit in resp.json()]
    assert len(response_ids) == 1


@pytest.mark.skip_nplusone_check
def test_similar_resources_endpoint_ignores_opensearch_published(mocker, client):
    """Test similar learning_resources ignores the published attribute from opensearch"""
    from learning_resources.models import LearningResource

    resources = LearningResourceFactory.create_batch(5)

    resource_ids = [learning_resource.id for learning_resource in resources]
    similar_for = resource_ids.pop()
    mocker.patch.object(Search, "execute")
    response_resources = LearningResource.objects.for_search_serialization().filter(
        id__in=resource_ids
    )
    response_hits = []
    for lr in response_resources:
        serialized_resource = serialize_learning_resource_for_update(lr)
        serialized_resource["published"] = False
        response_hits.append(serialized_resource)
    # remove the published attribute on one hit
    del response_hits[-1]["published"]
    Search.execute.return_value = response.Response(
        Search().query(),
        {
            "_shards": {"failed": 0, "successful": 10, "total": 10},
            "hits": {
                "hits": response_hits,
                "max_score": 12.0,
                "total": 123,
            },
            "timed_out": False,
            "took": 123,
        },
    ).hits
    resp = client.get(
        reverse("lr:v1:learning_resources_api-similar", args=[similar_for])
    )
    response_ids = [hit["id"] for hit in resp.json()]
    assert len(response_ids) == 4


@pytest.mark.skip_nplusone_check
def test_vector_similar_resources_endpoint_does_not_return_self(mocker, client):
    """Test vector based similar resources endpoint does not return initial id"""
    from learning_resources.models import LearningResource

    resources = LearningResourceFactory.create_batch(5)

    resource_ids = [learning_resource.id for learning_resource in resources]
    mocker.patch(
        "vector_search.utils.qdrant_client",
        return_value=QdrantClient(
            host="hidden_port_addr.com",
            port=None,
            prefix="custom",
        ),
    )
    mocker.patch(
        "learning_resources_search.api._qdrant_similar_results",
        return_value=[
            serialize_learning_resource_for_update(lr)
            for lr in LearningResource.objects.for_search_serialization().filter(
                id__in=resource_ids
            )
        ],
    )
    similar_for = resource_ids[0]
    resp = client.get(
        reverse("lr:v1:learning_resources_api-vector-similar", args=[similar_for])
    )
    response_ids = [hit["id"] for hit in resp.json()]
    assert similar_for not in response_ids


@pytest.mark.skip_nplusone_check
def test_vector_similar_resources_endpoint_only_returns_published(mocker, client):
    """Test vector based similar resources endpoint only returns published items"""
    from learning_resources.models import LearningResource

    resources = LearningResourceFactory.create_batch(5)

    resource_ids = [learning_resource.id for learning_resource in resources]
    similar_for = resource_ids.pop()
    response_resources = LearningResource.objects.for_search_serialization().filter(
        id__in=resource_ids
    )
    response_hits = []
    for lr in response_resources:
        serialized_resource = serialize_learning_resource_for_update(lr)
        serialized_resource["published"] = False
        response_hits.append(serialized_resource)
    # set one item to published
    response_hits[-1]["published"] = True
    mocker.patch(
        "learning_resources_search.api._qdrant_similar_results",
        return_value=response_hits,
    )
    mocker.patch(
        "vector_search.utils.qdrant_client",
        return_value=QdrantClient(
            host="hidden_port_addr.com",
            port=None,
            prefix="custom",
        ),
    )

    resp = client.get(
        reverse("lr:v1:learning_resources_api-vector-similar", args=[similar_for])
    )
    response_ids = [hit["id"] for hit in resp.json()]
    assert len(response_ids) == 1


@pytest.mark.skip_nplusone_check
def test_learning_resources_display_info_list_view(mocker, client):
    """Test learning_resources_display_info_list_view returns expected results"""
    from learning_resources.models import LearningResource

    LearningResource.objects.all().delete()
    resources = LearningResourceFactory.create_batch(
        5, published=True, title="test_learning_resources_display_info_list_view"
    )

    resource_ids = [learning_resource.id for learning_resource in resources]
    response_resources = LearningResource.objects.for_search_serialization().filter(
        id__in=resource_ids
    )
    response_hits = []
    for lr in response_resources:
        serialized_resource = LearningResourceDisplayInfoResponseSerializer(
            serialize_learning_resource_for_update(lr)
        ).data
        response_hits.append(serialized_resource)

    resp = client.get(
        reverse("lr:v1:learning_resource_display_info_api-list"),
        {"title": "test_learning_resources_display_info_list_view"},
    )
    results = resp.json()["results"]
    titles = [r["title"] for r in results]
    for hit in response_hits:
        assert hit["title"] in titles


def test_run_with_null_prices_does_not_throw_error(mocker, client):
    """Test learning_resources_display_info_detail_view does not throw exception"""
    from learning_resources.models import LearningResource

    run = LearningResourceRunFactory.create(
        run_id="test",
        learning_resource=CourseFactory.create(
            platform=PlatformType.ocw.name
        ).learning_resource,
    )
    run.prices = None
    run.save()

    lr = LearningResource.objects.for_search_serialization().get(
        id=run.learning_resource.id
    )
    serialized_resource = LearningResourceDisplayInfoResponseSerializer(
        serialize_learning_resource_for_update(lr)
    ).data

    resp = client.get(
        reverse(
            "lr:v1:learning_resource_display_info_api-detail",
            args=[run.learning_resource.id],
        )
    )
    assert_json_equal(resp.json(), serialized_resource, sort=True)


def test_learning_resources_display_info_detail_view(mocker, client):
    """Test learning_resources_display_info_detail_view returns expected result"""
    from learning_resources.models import LearningResource

    resource = LearningResource.objects.for_search_serialization().get(
        id=LearningResourceFactory.create().id
    )
    serialized_resource = LearningResourceDisplayInfoResponseSerializer(
        serialize_learning_resource_for_update(resource)
    ).data

    resp = client.get(
        reverse("lr:v1:learning_resource_display_info_api-detail", args=[resource.id])
    )

    assert resp.json() == serialized_resource


def test_learning_resources_summary_listing_endpoint(django_assert_num_queries, client):
    published = sorted(
        [
            # Some of the factories create multiple resources (e.g., program creates courses, too)
            # We want to create a specific number, so use courses/videos only
            *LearningResourceFactory.create_batch(
                10, published=True, resource_type="course"
            ),
            *LearningResourceFactory.create_batch(
                5, published=True, resource_type="video"
            ),
        ],
        key=lambda lr: lr.id,
    )
    # Create some unpublished resources to ensure they are not included in the summary
    LearningResourceFactory.create_batch(5, published=False, resource_type="course")
    LearningResourceFactory.create_batch(5, published=False, resource_type="video")

    with django_assert_num_queries(2):
        # One query for the pagination count, one for the results
        url = "lr:v1:learning_resources_api-summary"
        resp = client.get(f"{reverse(url)}")

    assert resp.data.get("count") == 15
    assert [
        {
            "id": lr.id,
            "last_modified": lr.last_modified.isoformat().replace("+00:00", "Z"),
        }
        for lr in published
    ] == sorted(resp.data.get("results"), key=lambda x: int(x["id"]))


def test_learning_resources_summary_listing_endpoint_large_pagesize():
    """
    Check the summary endpoint can handle large page sizes.
    A more authentic test would be to query the API directly, but that requires
    seeding the db with a large number of resources, making the test extremely
    slow.

    The frontend assumes page sizes of 1000 for sitemap generation.
    """
    action = next(
        a
        for a in LearningResourceViewSet.get_extra_actions()
        if a.url_name == "summary"
    )
    pagination = action.kwargs["pagination_class"]
    assert pagination.max_limit >= 1000


@pytest.mark.parametrize(
    "user_role",
    [
        "anonymous",
        "normal",
        "admin",
        "group_tutor_problem_viewer",
    ],
)
def test_course_run_problems_endpoint(client, user_role, django_user_model):
    """
    Test course run problems endpoint.

    All types of users should be able to get a list of problem set titles
    for a course run from api/v0/tutorproblems/<run_readable_id>

    Only admin and group_tutor_problem_viewer users should be able to get
    problem and solution content from
    api/v0/tutorproblems/<run_readable_id>/<problem_set_title>
    Normal users and anonymous users should receive a 403  response
    """
    course_run = LearningResourceRunFactory.create(
        learning_resource=CourseFactory.create(
            platform=PlatformType.canvas.name
        ).learning_resource,
    )

    if user_role == "admin":
        admin_user = django_user_model.objects.create_superuser(
            "admin", "admin@example.com", "pass"
        )
        client.force_login(admin_user)
    elif user_role == "group_tutor_problem_viewer":
        user = django_user_model.objects.create()
        group, _ = Group.objects.get_or_create(name=GROUP_TUTOR_PROBLEM_VIEWERS)
        group.user_set.add(user)
        client.force_login(user)
    elif user_role == "normal":
        user = django_user_model.objects.create()
        client.force_login(user)

    TutorProblemFileFactory.create(
        run=course_run,
        problem_title="Problem Set 1",
        type="problem",
        content="Content for Problem Set 1",
        file_name="problem1.txt",
        file_extension=".txt",
    )

    TutorProblemFileFactory.create(
        run=course_run,
        problem_title="Problem Set 1",
        type="problem",
        content="a,b\n1,1\n2,2\n3,3\n4,4\n5,5\n6,6",
        file_name="problem1-data.csv",
        file_extension=".csv",
    )

    TutorProblemFileFactory.create(
        run=course_run,
        problem_title="Problem Set 1",
        type="solution",
        content="Content for Problem Set 1 Solution",
        file_name="solution1.txt",
        file_extension=".txt",
    )
    TutorProblemFileFactory.create(
        run=course_run, problem_title="Problem Set 2", type="problem"
    )
    TutorProblemFileFactory.create(
        run=course_run, problem_title="Problem Set 2", type="solution"
    )

    resp = client.get(
        reverse("lr:v0:tutorproblem_api-list-problems", args=[course_run.run_id])
    )

    assert resp.json() == {"problem_set_titles": ["Problem Set 1", "Problem Set 2"]}

    detail_resp = client.get(
        reverse(
            "lr:v0:tutorproblem_api-retrieve-problem",
            args=[course_run.run_id, "Problem Set 1"],
        )
    )

    if user_role in ["admin", "group_tutor_problem_viewer"]:
        assert detail_resp.json() == {
            "problem_set_files": [
                {
                    "file_name": "problem1.txt",
                    "content": "Content for Problem Set 1",
                    "file_extension": ".txt",
                },
                {
                    "file_name": "problem1-data.csv",
                    "truncated_content": "a,b\n1,1\n2,2\n3,3\n4,4",
                    "file_extension": ".csv",
                    "note": "The content of the data file has been truncated to the column headers and first 4 rows.",
                    "number_of_records": 6,
                },
            ],
            "solution_set_files": [
                {
                    "file_name": "solution1.txt",
                    "content": "Content for Problem Set 1 Solution",
                    "file_extension": ".txt",
                },
            ],
        }
    elif user_role == "normal":
        assert detail_resp.status_code == 403
        assert detail_resp.json() == {
            "detail": "You do not have permission to perform this action.",
            "error_type": "PermissionDenied",
        }
    elif user_role == "anonymous":
        assert detail_resp.status_code == 403
        assert detail_resp.json() == {
            "detail": "Authentication credentials were not provided.",
            "error_type": "NotAuthenticated",
        }


def test_resource_items_only_shows_published_runs(client, user):
    """Test that ResourceListItemsViewSet only returns published runs for child resources"""

    program = LearningResourceFactory.create(
        resource_type=LearningResourceType.program.name,
        published=True,
    )
    course = LearningResourceFactory.create(
        resource_type=LearningResourceType.course.name,
        published=True,
        create_runs=False,
    )
    program.resources.set(
        [course], through_defaults={"relation_type": "program_courses"}
    )

    published_runs = LearningResourceRunFactory.create_batch(
        4,
        published=True,
        learning_resource=course,
    )
    unpublished_run = LearningResourceRunFactory.create(
        learning_resource=course,
        published=False,
    )
    course.runs.set(
        [
            *published_runs,
            unpublished_run,
        ]
    )
    assert course.runs.count() == 5

    client.force_login(user)
    url = reverse(
        "lr:v1:learning_resource_items_api-list",
        kwargs={"learning_resource_id": program.id},
    )
    resp = client.get(url)

    results = resp.json()["results"]
    assert len(results) == 1
    child_data = results[0]["resource"]
    assert child_data["id"] == course.id
    for idx, run in enumerate(child_data["runs"]):
        assert run["id"] in [run.id for run in published_runs]
        if idx > 0:
            assert (
                child_data["runs"][idx]["start_date"]
                >= child_data["runs"][idx - 1]["start_date"]
            )
    assert len(child_data["runs"]) == 4
