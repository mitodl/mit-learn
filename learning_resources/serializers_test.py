"""Tests for learning_resources serializers"""

import copy
import datetime
from decimal import Decimal

import pytest

from channels.factories import (
    ChannelDepartmentDetailFactory,
    ChannelTopicDetailFactory,
    ChannelUnitDetailFactory,
)
from channels.models import Channel
from learning_resources import factories, serializers
from learning_resources.constants import (
    CURRENCY_USD,
    LEARNING_MATERIAL_RESOURCE_CATEGORY,
    Availability,
    CertificationType,
    Format,
    LearningResourceDelivery,
    LearningResourceRelationTypes,
    LearningResourceType,
    Pace,
    PlatformType,
)
from learning_resources.etl.loaders import load_instructors
from learning_resources.factories import (
    LearningResourceFactory,
    LearningResourceInstructorFactory,
    LearningResourceOfferorFactory,
    LearningResourcePriceFactory,
    LearningResourceRunFactory,
)
from learning_resources.models import (
    ContentFile,
    LearningResource,
    LearningResourceRelationship,
)
from main.test_utils import assert_json_equal, drf_datetime
from main.utils import frontend_absolute_url

pytestmark = pytest.mark.django_db


datetime_format = "%Y-%m-%dT%H:%M:%SZ"
datetime_millis_format = "%Y-%m-%dT%H:%M:%S.%fZ"


def test_serialize_course_to_json():
    """
    Verify that a serialized course contains the expected attributes
    """
    course = factories.CourseFactory.create()
    serializer = serializers.CourseSerializer(instance=course)

    assert_json_equal(
        serializer.data,
        {
            "course_numbers": serializers.CourseNumberSerializer(
                instance=course.course_numbers, many=True
            ).data
        },
    )


def test_serialize_program_to_json():
    """
    Verify that a serialized program contains courses as LearningResources
    """
    program = factories.ProgramFactory.create()

    # Add an unpublished course to the program
    course = factories.CourseFactory.create(is_unpublished=True)
    program.learning_resource.resources.add(
        course.learning_resource,
        through_defaults={
            "relation_type": LearningResourceRelationTypes.PROGRAM_COURSES
        },
    )

    serializer = serializers.ProgramSerializer(instance=program)
    assert_json_equal(
        serializer.data,
        {"course_count": program.courses.filter(child__published=True).count()},
    )


def test_serialize_learning_path_to_json():
    """
    Verify that a serialized learning path has the correct data
    """
    learning_path = factories.LearningPathFactory.create()
    serializer = serializers.LearningPathSerializer(instance=learning_path)

    assert_json_equal(
        serializer.data,
        {
            "id": learning_path.id,
            "item_count": learning_path.learning_resource.children.count(),
        },
    )


def test_serialize_podcast_to_json():
    """
    Verify that a serialized podcast has the correct data
    """
    podcast = factories.PodcastFactory.create()
    serializer = serializers.PodcastSerializer(instance=podcast)

    assert_json_equal(
        serializer.data,
        {
            "apple_podcasts_url": podcast.apple_podcasts_url,
            "episode_count": podcast.learning_resource.children.count(),
            "google_podcasts_url": podcast.google_podcasts_url,
            "id": podcast.id,
            "rss_url": podcast.rss_url,
        },
    )


def test_serialize_podcast_episode_to_json():
    """
    Verify that a serialized podcast episode has the correct data
    """
    podcast_episode = factories.PodcastEpisodeFactory.create()
    serializer = serializers.PodcastEpisodeSerializer(instance=podcast_episode)

    assert_json_equal(
        serializer.data,
        {
            "duration": podcast_episode.duration,
            "audio_url": podcast_episode.audio_url,
            "episode_link": podcast_episode.episode_link,
            "podcasts": podcast_episode.learning_resource.parents.filter(
                relation_type=LearningResourceRelationTypes.PODCAST_EPISODES.value
            ).values_list("parent__id", flat=True),
            "id": podcast_episode.id,
            "rss": podcast_episode.rss,
            "transcript": podcast_episode.transcript,
        },
    )


def test_serialize_video_resource_playlists_to_json():
    """
    Verify that a serialized video resource has the correct playlist data
    """
    playlist = factories.VideoPlaylistFactory.create()
    video = factories.VideoFactory.create()
    LearningResourceRelationship.objects.get_or_create(
        parent=playlist.learning_resource,
        child=video.learning_resource,
        relation_type=LearningResourceRelationTypes.PLAYLIST_VIDEOS.value,
    )
    serializer = serializers.VideoResourceSerializer(instance=video.learning_resource)
    assert serializer.data["playlists"] == [playlist.learning_resource.id]


def test_serialize_podcast_episode_playlists_to_json():
    """
    Verify that a serialized podcast episode resource has the correct podcast data
    """
    podcast = factories.PodcastFactory.create()
    podcast_episode = factories.PodcastEpisodeFactory.create()
    LearningResourceRelationship.objects.get_or_create(
        parent=podcast.learning_resource,
        child=podcast_episode.learning_resource,
        relation_type=LearningResourceRelationTypes.PODCAST_EPISODES.value,
    )
    serializer = serializers.PodcastEpisodeSerializer(instance=podcast_episode)
    assert serializer.data["podcasts"] == [podcast.learning_resource.id]


@pytest.mark.parametrize("has_context", [True, False])
@pytest.mark.parametrize(
    ("params", "detail_key", "specific_serializer_cls", "detail_serializer_cls"),
    [
        (
            {"is_program": True},
            "program",
            serializers.ProgramResourceSerializer,
            serializers.ProgramSerializer,
        ),
        (
            {"is_course": True},
            "course",
            serializers.CourseResourceSerializer,
            serializers.CourseSerializer,
        ),
        (
            {"is_learning_path": True},
            "learning_path",
            serializers.LearningPathResourceSerializer,
            serializers.LearningPathSerializer,
        ),
        (
            {"is_podcast": True},
            "podcast",
            serializers.PodcastResourceSerializer,
            serializers.PodcastSerializer,
        ),
        (
            {"is_podcast_episode": True},
            "podcast_episode",
            serializers.PodcastEpisodeResourceSerializer,
            serializers.PodcastEpisodeSerializer,
        ),
    ],
)
def test_learning_resource_serializer(  # noqa: PLR0913
    rf,
    user,
    has_context,
    params,
    detail_key,
    specific_serializer_cls,
    detail_serializer_cls,
):
    """Test that LearningResourceSerializer uses the correct serializer"""
    request = rf.get("/")
    request.user = user
    context = {"request": request} if has_context else {}

    resource = factories.LearningResourceFactory.create(**params)
    for department in resource.departments.all():
        ChannelDepartmentDetailFactory.create(department=department)

    resource = LearningResource.objects.for_serialization().get(pk=resource.pk)

    result = serializers.LearningResourceSerializer(
        instance=resource, context=context
    ).data
    expected = specific_serializer_cls(instance=resource, context=context).data

    if resource.resource_type in [
        LearningResourceType.course.name,
        LearningResourceType.program.name,
    ]:
        resource_category = resource.resource_type
    else:
        resource_category = LEARNING_MATERIAL_RESOURCE_CATEGORY
    assert result == expected
    assert result == {
        "id": resource.id,
        "title": resource.title,
        "description": resource.description,
        "full_description": resource.full_description,
        "languages": resource.languages,
        "last_modified": drf_datetime(resource.last_modified),
        "require_summaries": resource.require_summaries,
        "children": serializers.LearningResourceRelationshipChildField(
            resource.children.all(), many=True
        ).data,
        "offered_by": serializers.LearningResourceOfferorSerializer(
            instance=resource.offered_by
        ).data,
        "platform": serializers.LearningResourcePlatformSerializer(
            instance=resource.platform
        ).data,
        "prices": sorted([f"{price:.2f}" for price in resource.prices]),
        "resource_prices": sorted(
            [
                {"amount": f"{price:.2f}", "currency": CURRENCY_USD}
                for price in resource.resource_prices.all()
            ],
            key=lambda price: price.amount,
        ),
        "professional": resource.professional,
        "test_mode": False,
        "position": None,
        "certification": resource.certification,
        "certification_type": {
            "code": resource.certification_type,
            "name": CertificationType[resource.certification_type].value,
        },
        "free": (
            detail_key
            not in (LearningResourceType.course.name, LearningResourceType.program.name)
            or (
                not resource.professional
                and (
                    not resource.resource_prices.all()
                    or all(
                        price.amount == Decimal("0.00")
                        for price in resource.resource_prices.all()
                    )
                )
            )
        ),
        "resource_category": resource_category,
        "published": resource.published,
        "readable_id": resource.readable_id,
        "course_feature": sorted([tag.name for tag in resource.content_tags.all()]),
        "resource_type": resource.resource_type,
        "url": resource.url,
        "image": serializers.LearningResourceImageSerializer(
            instance=resource.image
        ).data,
        "departments": [
            {
                "department_id": dept.department_id,
                "name": dept.name,
                "channel_url": frontend_absolute_url(
                    f"/c/department/{Channel.objects.get(department_detail__department=dept).name}/",
                ),
                "school": {
                    "id": dept.school.id,
                    "name": dept.school.name,
                    "url": dept.school.url,
                },
            }
            for dept in resource.departments.all()
        ],
        "topics": [
            serializers.LearningResourceTopicSerializer(topic).data
            for topic in resource.topics.all()
        ],
        "ocw_topics": sorted(resource.ocw_topics),
        "runs": [
            serializers.LearningResourceRunSerializer(instance=run).data
            for run in resource.published_runs
        ],
        detail_key: detail_serializer_cls(instance=getattr(resource, detail_key)).data,
        "views": resource.views.count(),
        "delivery": [
            {"code": lr_delivery, "name": LearningResourceDelivery[lr_delivery].value}
            for lr_delivery in resource.delivery
        ],
        "format": [
            {"code": lr_format, "name": Format[lr_format].value}
            for lr_format in resource.format
        ],
        "pace": [
            {"code": lr_pace, "name": Pace[lr_pace].value} for lr_pace in resource.pace
        ],
        "location": resource.location,
        "next_start_date": resource.next_start_date,
        "availability": resource.availability,
        "completeness": 1.0,
        "continuing_ed_credits": resource.continuing_ed_credits,
        "license_cc": resource.license_cc,
        "duration": resource.duration,
        "time_commitment": resource.time_commitment,
        "min_weekly_hours": resource.min_weekly_hours,
        "max_weekly_hours": resource.max_weekly_hours,
        "min_weeks": resource.min_weeks,
        "max_weeks": resource.max_weeks,
        "best_run_id": resource.best_run.id if resource.best_run else None,
    }


def test_serialize_run_related_models():
    """
    Verify that a serialized run contains attributes for related objects
    """
    run = factories.LearningResourceRunFactory()
    serializer = serializers.LearningResourceRunSerializer(run)
    assert len(serializer.data["prices"]) > 0
    assert str(serializer.data["prices"][0].replace(".", "")).isnumeric()
    assert len(serializer.data["resource_prices"]) > 0
    assert serializer.data["resource_prices"][0]["amount"].replace(".", "").isnumeric()
    assert len(serializer.data["instructors"]) > 0
    for attr in ("first_name", "last_name", "full_name"):
        assert attr in serializer.data["instructors"][0]


@pytest.mark.parametrize(
    ("data", "error"),
    [
        (9999, "Invalid topic ids: {9999}"),
        (None, "Invalid topic ids: {None}"),
        ("a", "Topic ids must be integers"),
    ],
)
def test_learningpath_serializer_validation_bad_topic(data, error):
    """
    Test that the LearningPathResourceSerializer invalidates a non-existent topic
    """
    serializer_data = {
        "readable_id": "abc123",
        "title": "My List",
        "description": "My Description",
        "topics": [data],
        "resource_type": LearningResourceType.learning_path.name,
    }
    serializer = serializers.LearningPathResourceSerializer(data=serializer_data)
    assert serializer.is_valid() is False
    assert serializer.errors["topics"][0] == error


def test_learningpath_serializer_validation():
    """
    Test that the LearningPathResourceSerializer validates and saves properly
    """
    topic_ids = [
        topic.id for topic in factories.LearningResourceTopicFactory.create_batch(3)
    ]
    serializer_data = {
        "readable_id": "abc123",
        "title": "My List",
        "description": "My Description",
        "topics": topic_ids,
        "resource_type": LearningResourceType.learning_path.name,
    }
    serializer = serializers.LearningPathResourceSerializer(data=serializer_data)
    assert serializer.is_valid(raise_exception=True)


@pytest.mark.parametrize("child_exists", [True, False])
def test_learningpathitem_serializer_validation(child_exists):
    """
    Test that the StaffListItemSerializer validates content_type and object correctly
    """
    learning_path = factories.LearningPathFactory.create()
    data = {
        "parent": learning_path.learning_resource.id,
        "child": (
            factories.CourseFactory.create().learning_resource.id
            if child_exists
            else 9999
        ),
        "relation_type": LearningResourceRelationTypes.LEARNING_PATH_ITEMS.value,
    }
    serializer = serializers.LearningResourceRelationshipSerializer(data=data)
    assert serializer.is_valid() is child_exists
    if child_exists:
        serializer.save()
        saved_item = learning_path.learning_resource.children.all().first()
        assert (
            saved_item.relation_type
            == LearningResourceRelationTypes.LEARNING_PATH_ITEMS.value
        )


@pytest.mark.parametrize(
    "expected_types", [["Assignments", "Tools"], ["Lecture Audio"], [], None]
)
@pytest.mark.parametrize("has_channels", [True, False])
def test_content_file_serializer(settings, expected_types, has_channels):
    """Verify that the ContentFileSerializer has the correct data"""
    settings.APP_BASE_URL = "https://test.edu/"
    content_kwargs = {
        "content": "Test content",
        "content_author": "MIT",
        "content_language": "en",
        "content_title": "test title",
        "edx_module_id": "edx_module_id",
    }
    platform = PlatformType.ocw.name
    course = factories.CourseFactory.create(platform=platform)
    content_file = factories.ContentFileFactory.create(
        run=course.learning_resource.runs.first(), **content_kwargs
    )
    if has_channels:
        for topic in content_file.run.learning_resource.topics.all():
            ChannelTopicDetailFactory.create(topic=topic)

        for department in course.learning_resource.departments.all():
            ChannelDepartmentDetailFactory.create(department=department)
        ChannelUnitDetailFactory.create(unit=course.learning_resource.offered_by)

    content_file = ContentFile.objects.for_serialization().get(pk=content_file.pk)

    serialized = serializers.ContentFileSerializer(content_file).data

    assert_json_equal(
        serialized,
        {
            "id": content_file.id,
            "run_id": content_file.run.id,
            "run_readable_id": content_file.run.run_id,
            "platform": {
                "name": PlatformType[platform].value,
                "code": platform,
            },
            "file_extension": content_file.file_extension,
            "offered_by": {
                "name": content_file.run.learning_resource.offered_by.name,
                "code": content_file.run.learning_resource.offered_by.code,
                "display_facet": True,
                "channel_url": frontend_absolute_url(
                    f"/c/unit/{Channel.objects.get(unit_detail__unit=content_file.run.learning_resource.offered_by).name}/"
                )
                if has_channels
                else None,
            },
            "run_title": content_file.run.title,
            "run_slug": content_file.run.slug,
            "departments": [
                {
                    "name": dept.name,
                    "department_id": dept.department_id,
                    "channel_url": frontend_absolute_url(
                        f"/c/department/{Channel.objects.get(department_detail__department=dept).name}/"
                    )
                    if has_channels
                    else None,
                    "school": {
                        "id": dept.school.id,
                        "name": dept.school.name,
                        "url": dept.school.url,
                    }
                    if dept.school
                    else None,
                }
                for dept in content_file.run.learning_resource.departments.all()
            ],
            "semester": content_file.run.semester,
            "year": int(content_file.run.year),
            "topics": [
                {
                    "name": topic.name,
                    "id": topic.id,
                    "icon": topic.icon,
                    "parent": topic.parent,
                    "channel_url": frontend_absolute_url(
                        f"/c/topic/{Channel.objects.get(topic_detail__topic=topic).name}/"
                        if has_channels
                        else None,
                    )
                    if has_channels
                    else None,
                }
                for topic in content_file.run.learning_resource.topics.all()
            ],
            "key": content_file.key,
            "source_path": content_file.source_path,
            "uid": content_file.uid,
            "title": content_file.title,
            "description": content_file.description,
            "require_summaries": content_file.run.learning_resource.require_summaries,
            "file_type": content_file.file_type,
            "content_type": content_file.content_type,
            "checksum": content_file.checksum,
            "url": content_file.url,
            "content": content_kwargs["content"],
            "content_title": content_kwargs["content_title"],
            "content_author": content_kwargs["content_author"],
            "content_language": content_kwargs["content_language"],
            "image_src": content_file.image_src,
            "resource_id": str(content_file.run.learning_resource.id),
            "resource_readable_id": content_file.run.learning_resource.readable_id,
            "course_number": [
                coursenum["value"]
                for coursenum in content_file.run.learning_resource.course.course_numbers
            ],
            "content_feature_type": sorted(
                [tag.name for tag in content_file.content_tags.all()]
            ),
            "edx_module_id": content_file.edx_module_id,
            "summary": content_file.summary,
            "flashcards": content_file.flashcards,
        },
    )


def test_set_learning_path_request_serializer():
    """Test serializer for setting learning path relationships"""
    lists = factories.LearningPathFactory.create_batch(2)
    resource = factories.LearningResourceFactory.create()

    serializer = serializers.SetLearningPathsRequestSerializer()

    data1 = {
        "learning_path_ids": [
            str(lists[0].learning_resource.id),
            lists[1].learning_resource.id,
        ],
        "learning_resource_id": str(resource.id),
    }
    assert serializer.to_internal_value(data1) == {
        "learning_path_ids": [
            lists[0].learning_resource.id,
            lists[1].learning_resource.id,
        ],
        "learning_resource_id": resource.id,
    }

    invalid = serializers.SetLearningPathsRequestSerializer(
        data={"learning_path_ids": [1, 2], "learning_resource_id": 3}
    )
    assert invalid.is_valid() is False
    assert "learning_path_ids" in invalid.errors
    assert "learning_resource_id" in invalid.errors


def test_set_userlist_request_serializer():
    """Test serializer for setting userlist relationships"""
    lists = factories.UserListFactory.create_batch(2)
    resource = factories.LearningResourceFactory.create()

    serializer = serializers.SetUserListsRequestSerializer()

    data1 = {
        "userlist_ids": [str(lists[0].id), lists[1].id],
        "learning_resource_id": str(resource.id),
    }
    assert serializer.to_internal_value(data1) == {
        "userlist_ids": [lists[0].id, lists[1].id],
        "learning_resource_id": resource.id,
    }


def test_set_userlist_request_serializer_invalid():
    """Test serializer errors for bad userlist relationship data"""
    invalid = serializers.SetUserListsRequestSerializer(
        data={"userlist_ids": [-1, -2], "learning_resource_id": -3}
    )
    assert invalid.is_valid() is False
    assert "userlist_ids" in invalid.errors
    assert "learning_resource_id" in invalid.errors


def _create_identical_runs_resource():
    learning_resource = LearningResourceFactory.create(
        professional=False,
        resource_type="course",
        runs=[],
        certification=True,
        delivery=["in_person"],
    )
    learning_resource.resource_prices.set(
        [LearningResourcePriceFactory.create(amount=Decimal("1.00"), currency="USD")]
    )
    start_date = datetime.datetime.now(tz=datetime.UTC)
    run = LearningResourceRunFactory.create(
        learning_resource=learning_resource,
        published=True,
        start_date=start_date,
        location="online",
        delivery=["in_person"],
        prices=[Decimal("0.00"), Decimal("1.00")],
        resource_prices=[
            LearningResourcePriceFactory.create(amount=Decimal("1.00"), currency="USD")
        ],
    )
    run.prices = [Decimal("1.00")]
    run.save()
    run = LearningResourceRunFactory.create(
        learning_resource=learning_resource,
        published=True,
        prices=[Decimal("0.00"), Decimal("1.00")],
        start_date=start_date,
        location="online",
        delivery=["in_person"],
        resource_prices=[
            LearningResourcePriceFactory.create(amount=Decimal("1.00"), currency="USD")
        ],
    )
    run.save()
    return learning_resource


def test_certificate_display():
    # If certification is none and the resource is free - show "no certificate"
    resource = LearningResourceFactory(
        certification_type=CertificationType.none.name,
        professional=False,
        prices=[Decimal("0.00")],
    )
    serialized_resource = serializers.LearningResourceSerializer(resource).data
    metadata_serializer = serializers.LearningResourceMetadataDisplaySerializer(
        serialized_resource
    )
    assert serialized_resource["free"]
    assert metadata_serializer.data["certification"] == CertificationType.none.value

    # If course is "free" and certificate type is not explicitly "none" then dont display anything
    resource = LearningResourceFactory(
        certification_type=CertificationType.completion.name,
        prices=[Decimal("0.00")],
        resource_type="course",
        professional=False,
    )
    resource.resource_prices.set(
        [LearningResourcePriceFactory.create(amount=Decimal("0.00"))]
    )
    serialized_resource = serializers.LearningResourceSerializer(resource).data
    metadata_serializer = serializers.LearningResourceMetadataDisplaySerializer(
        serialized_resource
    )
    assert serialized_resource["free"]
    assert metadata_serializer.data.get("certification") is None

    # If resource is not free and certification is not none - show the certification type
    resource = LearningResourceFactory(
        certification=False,
        professional=False,
        resource_type="course",
        certification_type=CertificationType.professional.name,
        prices=[Decimal("100.00")],
        offered_by=LearningResourceOfferorFactory.create(professional=False),
    )
    resource.resource_prices.set(
        [LearningResourcePriceFactory.create(amount=Decimal("100.00"))]
    )
    serialized_resource = serializers.LearningResourceSerializer(resource).data
    metadata_serializer = serializers.LearningResourceMetadataDisplaySerializer(
        serialized_resource
    )

    assert not serialized_resource["free"]
    assert (
        metadata_serializer.data["certification"]
        == CertificationType.professional.value
    )


def test_price_display():
    # If certification is none and the resource is free - show "free"
    resource = _create_identical_runs_resource()
    resource.resource_prices.set(
        [
            LearningResourcePriceFactory.create(amount=Decimal("0.00")),
            LearningResourcePriceFactory.create(amount=Decimal("100.00")),
        ]
    )
    serialized_resource = serializers.LearningResourceSerializer(resource).data
    metadata_serializer = serializers.LearningResourceMetadataDisplaySerializer(
        serialized_resource
    )
    assert serialized_resource["free"]
    assert metadata_serializer.data["price"] == "Free"

    # If course is "free" and certificate type is not explicitly "none" then display Free as well as certificate price
    resource = _create_identical_runs_resource()
    resource.prices = [Decimal("0.00"), Decimal("100.00")]
    resource.resource_prices.set(
        [
            LearningResourcePriceFactory.create(amount=Decimal("0.00")),
            LearningResourcePriceFactory.create(amount=Decimal("100.00")),
        ]
    )
    serialized_resource = serializers.LearningResourceSerializer(resource).data
    metadata_serializer = serializers.LearningResourceMetadataDisplaySerializer(
        serialized_resource
    )
    assert serialized_resource["free"]
    assert metadata_serializer.data["price"] == "Free"
    assert (
        metadata_serializer.data["extra_price_info"]
        == f"Earn a certificate: ${serialized_resource['prices'][1]}"
    )

    # If resource is not free and certification is not none - show the price
    resource = _create_identical_runs_resource()
    resource.resource_prices.set(
        [LearningResourcePriceFactory.create(amount=Decimal("100.00"))]
    )
    resource.prices = [Decimal("100.00")]
    resource.save()
    serialized_resource = serializers.LearningResourceSerializer(resource).data
    metadata_serializer = serializers.LearningResourceMetadataDisplaySerializer(
        serialized_resource
    )
    assert not serialized_resource["free"]
    assert metadata_serializer.data["price"] == f"${serialized_resource['prices'][0]}"
    assert metadata_serializer.data["extra_price_info"] is None


def test_instructors_display():
    """Test that the instructors_display field is correctly populated"""
    resource = LearningResourceFactory()
    resource.runs.all().delete()
    serialized_resource = serializers.LearningResourceSerializer(resource).data
    metadata_serializer = serializers.LearningResourceMetadataDisplaySerializer(
        serialized_resource
    )

    assert metadata_serializer.data["instructors"] is None

    instructors = LearningResourceInstructorFactory.create_batch(3)
    run = LearningResourceRunFactory.create(
        learning_resource=resource, no_instructors=True
    )
    assert run.instructors.count() == 0
    load_instructors(
        run, [{"full_name": instructor.full_name} for instructor in instructors]
    )
    # Clear cached properties so they pick up the new run with instructors
    if hasattr(resource, "_published_runs"):
        delattr(resource, "_published_runs")
    if hasattr(resource, "published_runs"):
        del resource.__dict__["published_runs"]
    serialized_resource = serializers.LearningResourceSerializer(resource).data
    metadata_serializer = serializers.LearningResourceMetadataDisplaySerializer(
        serialized_resource
    )
    assert sorted(metadata_serializer.data["instructors"]) == sorted(
        [instructor.full_name for instructor in instructors]
    )


def test_metadata_display_serializer_all_runs_are_identical():
    learning_resource = _create_identical_runs_resource()
    identical_runs_resource = serializers.LearningResourceSerializer(
        learning_resource
    ).data

    display_data_serializer = serializers.LearningResourceMetadataDisplaySerializer(
        identical_runs_resource
    )

    assert display_data_serializer.all_runs_are_identical(identical_runs_resource)
    """
    Start testing qualities that will cause all_runs_are_identical to return False
    """

    # Test that all_runs_are_identical will return False if there is more than 1 delivery type
    differing_runs_resource = copy.deepcopy(identical_runs_resource)
    differing_runs_resource["runs"][0]["delivery"] = [
        {
            "name": "online",
            "code": "online",
        },
        {
            "name": "offline",
            "code": "offline",
        },
    ]
    assert (
        display_data_serializer.all_runs_are_identical(differing_runs_resource) is False
    )
    # Test that all_runs_are_identical will return False if not all runs have same prices
    differing_runs_resource = copy.deepcopy(identical_runs_resource)
    differing_runs_resource["runs"][0]["resource_prices"] = [
        {"amount": "10.00", "currency": "USD"},
        {"amount": "20.00", "currency": "BTC"},
    ]
    differing_runs_resource["runs"][1]["resource_prices"] = [
        {"amount": "10.00", "currency": "USD"},
        {"amount": "21.00", "currency": "BTC"},
    ]
    assert (
        display_data_serializer.all_runs_are_identical(differing_runs_resource) is False
    )

    # Test that all_runs_are_identical will return True if all runs DO have same prices
    differing_runs_resource = copy.deepcopy(identical_runs_resource)
    differing_runs_resource["runs"][0]["resource_prices"] = [
        {"amount": "10.00", "currency": "USD"},
        {"amount": "20.00", "currency": "BTC"},
    ]
    differing_runs_resource["runs"][1]["resource_prices"] = [
        {"amount": "10.00", "currency": "USD"},
        {"amount": "20.00", "currency": "BTC"},
    ]
    assert (
        display_data_serializer.all_runs_are_identical(differing_runs_resource) is True
    )
    """
    Test that all_runs_are_identical will return False if there is more than 1 unique location
    and the delivery method is in_person or hybrid
    """
    differing_runs_resource = copy.deepcopy(identical_runs_resource)
    differing_runs_resource["runs"][0]["location"] = "test"
    differing_runs_resource["runs"][1]["location"] = "other"
    differing_runs_resource["delivery"] = [
        {
            "code": LearningResourceDelivery.in_person.name,
            "name": LearningResourceDelivery.in_person.value,
        }
    ]
    assert (
        display_data_serializer.all_runs_are_identical(differing_runs_resource) is False
    )

    """
    Test that all_runs_are_identical will return False if there is more than 1 unique location
    and the delivery method is in_person or hybrid
    """
    differing_runs_resource = copy.deepcopy(identical_runs_resource)
    differing_runs_resource["runs"][0]["location"] = "test"
    differing_runs_resource["delivery"] = [
        {"code": LearningResourceDelivery.online.name}
    ]
    assert (
        display_data_serializer.all_runs_are_identical(differing_runs_resource) is False
    )


def test_metadata_display_serializer_show_start_anytime():
    learning_resource = LearningResourceFactory.create(
        professional=False,
        resource_type="course",
        runs=[],
        certification=True,
        delivery=[LearningResourceDelivery.in_person.name],
        availability=Availability.anytime.name,
    )
    serialized_resource = serializers.LearningResourceSerializer(learning_resource).data
    metadata_serializer = serializers.LearningResourceMetadataDisplaySerializer(
        serialized_resource
    )
    assert metadata_serializer.show_start_anytime(serialized_resource)
    learning_resource = LearningResourceFactory.create(
        professional=False,
        resource_type="course",
        runs=[],
        certification=True,
        delivery=["in_person"],
        availability=Availability.dated.name,
    )
    serialized_resource = serializers.LearningResourceSerializer(learning_resource).data
    metadata_serializer = serializers.LearningResourceMetadataDisplaySerializer(
        serialized_resource
    )
    assert metadata_serializer.show_start_anytime(serialized_resource) is False


def test_total_runs_with_dates(mocker):
    """
    Test total_runs_with_dates method
    """
    mocker.patch(
        "learning_resources.serializers.LearningResourceMetadataDisplaySerializer.dates_for_runs",
        return_value=["2023-01-01", "2023-02-01"],
    )
    serializer = serializers.LearningResourceMetadataDisplaySerializer()
    serialized_resource = mocker.Mock()
    assert serializer.total_runs_with_dates(serialized_resource) == 2


def test_total_runs_with_dates_no_runs(mocker):
    """
    Test total_runs_with_dates method with no runs
    """
    mocker.patch(
        "learning_resources.serializers.LearningResourceMetadataDisplaySerializer.dates_for_runs",
        return_value=[],
    )
    serializer = serializers.LearningResourceMetadataDisplaySerializer()
    serialized_resource = mocker.Mock()
    assert serializer.total_runs_with_dates(serialized_resource) == 0


def test_total_runs_with_dates_single_run(mocker):
    """
    Test total_runs_with_dates method with a single run
    """
    mocker.patch(
        "learning_resources.serializers.LearningResourceMetadataDisplaySerializer.dates_for_runs",
        return_value=["2023-01-01"],
    )
    serializer = serializers.LearningResourceMetadataDisplaySerializer()
    serialized_resource = mocker.Mock()
    assert serializer.total_runs_with_dates(serialized_resource) == 1


def test_metadata_display_serializer_should_show_format():
    learning_resource = _create_identical_runs_resource()
    serialized_resource = serializers.LearningResourceSerializer(learning_resource).data
    metadata_serializer = serializers.LearningResourceMetadataDisplaySerializer(
        serialized_resource
    )
    assert metadata_serializer.should_show_format(serialized_resource)
    serialized = copy.deepcopy(serialized_resource)
    serialized["delivery"] = []
    assert metadata_serializer.should_show_format(serialized) is False

    serialized = copy.deepcopy(serialized_resource)
    serialized["resource_type"] = "podcast"
    assert metadata_serializer.should_show_format(serialized) is False
