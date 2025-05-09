"""Next OCW ETL tests"""

import json
from datetime import UTC, datetime
from pathlib import Path

import boto3
import pytest
from moto import mock_aws

from learning_resources.conftest import OCW_TEST_PREFIX, setup_s3_ocw
from learning_resources.constants import (
    DEPARTMENTS,
    Availability,
    Format,
    LearningResourceDelivery,
    Pace,
)
from learning_resources.etl.constants import CourseNumberType, ETLSource
from learning_resources.etl.ocw import (
    parse_learn_topics,
    transform_content_files,
    transform_contentfile,
    transform_course,
)
from learning_resources.factories import (
    ContentFileFactory,
    LearningResourceTopicFactory,
)
from learning_resources.models import ContentFile
from learning_resources.utils import (
    get_s3_object_and_read,
    safe_load_json,
)
from main.utils import clean_data, now_in_utc

pytestmark = pytest.mark.django_db


@mock_aws
@pytest.mark.parametrize("base_ocw_url", ["http://test.edu/", "http://test.edu"])
def test_transform_content_files(settings, mocker, base_ocw_url):
    """
    Test that ocw.transform_content_files returns the expected data
    """
    settings.OCW_BASE_URL = base_ocw_url
    ocw_url = base_ocw_url.rstrip("/")
    setup_s3_ocw(settings)
    s3_resource = boto3.resource("s3")
    mocker.patch(
        "learning_resources.etl.ocw.extract_text_metadata",
        return_value={"content": "TEXT"},
    )

    content_data = list(
        transform_content_files(s3_resource, OCW_TEST_PREFIX, False)  # noqa: FBT003
    )

    assert len(content_data) == 5

    assert content_data[0] == {
        "content": "Pages Section",
        "content_type": "page",
        "key": (
            "courses/16-01-unified-engineering-i-ii-iii-iv-fall-2005-spring-2006/pages/"
        ),
        "published": True,
        "title": "Pages",
        "content_title": "Pages",
        "url": f"{ocw_url}/courses/16-01-unified-engineering-i-ii-iii-iv-fall-2005-spring-2006/pages/",
    }

    assert content_data[1] == {
        "content": "Course Meeting Times Lecture",
        "content_type": "page",
        "key": "courses/16-01-unified-engineering-i-ii-iii-iv-fall-2005-spring-2006/pages/syllabus/",
        "published": True,
        "title": "Syllabus",
        "content_title": "Syllabus",
        "url": f"{ocw_url}/courses/16-01-unified-engineering-i-ii-iii-iv-fall-2005-spring-2006/pages/syllabus/",
    }

    assert content_data[2] == {
        "content": "TEXT",
        "content_type": "pdf",
        "description": "This resource contains problem set 1",
        "file_type": "application/pdf",
        "key": "courses/16-01-unified-engineering-i-ii-iii-iv-fall-2005-spring-2006/resources/resource/",
        "content_tags": [
            "Activity Assignments",
            "Activity Assignments with Examples",
        ],
        "published": True,
        "title": "Resource Title",
        "content_title": "Resource Title",
        "url": f"{ocw_url}/courses/16-01-unified-engineering-i-ii-iii-iv-fall-2005-spring-2006/resources/resource/",
        "file_extension": ".pdf",
    }

    assert content_data[3] == {
        "content": "TEXT",
        "content_type": "video",
        "description": "Video Description",
        "file_type": "video/mp4",
        "key": "courses/16-01-unified-engineering-i-ii-iii-iv-fall-2005-spring-2006/resources/video/",
        "content_tags": ["Competition Videos"],
        "published": True,
        "title": None,
        "content_title": None,
        "url": f"{ocw_url}/courses/16-01-unified-engineering-i-ii-iii-iv-fall-2005-spring-2006/resources/video/",
        "image_src": "https://img.youtube.com/vi/vKer2U5W5-s/default.jpg",
        "file_extension": ".mp4",
    }

    assert content_data[4] == {
        "content": "TEXT",
        "content_type": "video",
        "description": "Video Description, no file",
        "file_type": "video/mp4",
        "key": "courses/16-01-unified-engineering-i-ii-iii-iv-fall-2005-spring-2006/resources/video_no_file/",
        "content_tags": ["Old Videos"],
        "published": True,
        "title": None,
        "content_title": None,
        "url": f"{ocw_url}/courses/16-01-unified-engineering-i-ii-iii-iv-fall-2005-spring-2006/resources/video_no_file/",
        "image_src": "https://img.youtube.com/vi/vKer2U5W5-s/default.jpg",
        "file_extension": ".mp4",
    }


@mock_aws
def test_transform_content_files_exceptions(settings, mocker):
    """
    Test that ocw.transform_content_files logs exceptions
    """

    setup_s3_ocw(settings)
    s3_resource = boto3.resource("s3")
    mock_log = mocker.patch("learning_resources.etl.ocw.log.exception")
    mocker.patch(
        "learning_resources.etl.ocw.get_s3_object_and_read", side_effect=Exception
    )
    content_data = list(
        transform_content_files(s3_resource, OCW_TEST_PREFIX, False)  # noqa: FBT003
    )
    assert len(content_data) == 0
    assert mock_log.call_count == 7


@mock_aws
@pytest.mark.parametrize("overwrite", [True, False])
@pytest.mark.parametrize("modified_after_last_import", [True, False])
def test_transform_content_file_needs_text_update(
    settings, mocker, overwrite, modified_after_last_import
):
    """
    Test transform_resource
    """

    setup_s3_ocw(settings)
    s3_resource = boto3.resource("s3")
    mock_tika = mocker.patch(
        "learning_resources.etl.ocw.extract_text_metadata",
        return_value={"content": "TEXT"},
    )
    s3_resource_object = s3_resource.Object(
        settings.OCW_LIVE_BUCKET,
        "courses/16-01-unified-engineering-i-ii-iii-iv-fall-2005-spring-2006/resources/resource/data.json",
    )
    resource_json = safe_load_json(
        get_s3_object_and_read(s3_resource_object), s3_resource_object.key
    )

    ContentFileFactory.create(
        key="courses/16-01-unified-engineering-i-ii-iii-iv-fall-2005-spring-2006/resources/resource/"
    )

    if modified_after_last_import:
        ContentFile.objects.update(updated_on=datetime(2020, 12, 1, tzinfo=UTC))

    content_data = transform_contentfile(
        s3_resource_object.key, resource_json, s3_resource, overwrite
    )

    if overwrite or modified_after_last_import:
        mock_tika.assert_called_once()

        assert content_data["content"] == "TEXT"
    else:
        mock_tika.assert_not_called()
        assert "content" not in content_data


@mock_aws
@pytest.mark.parametrize(
    (
        "legacy_uid",
        "site_uid",
        "expected_uid",
        "has_extra_num",
        "term",
        "year",
        "expected_id",
        "hide_download",
    ),
    [
        (
            "legacy-uid",
            None,
            "legacyuid",
            False,
            "Spring",
            "2005",
            "16.01+spring_2005",
            False,
        ),
        (None, "site-uid", "siteuid", True, "", 2005, "16.01_2005", True),
        (None, "site-uid", "siteuid", True, "Fall", 2005, "16.01+fall_2005", None),
        (None, "site-uid", "siteuid", True, "Fall", None, "16.01+fall", False),
        (None, "site-uid", "siteuid", True, "", "", "16.01", True),
        (None, "site-uid", "siteuid", True, None, None, "16.01", False),
        (None, None, None, True, "Spring", "2005", None, None),
    ],
)
def test_transform_course(  # noqa: PLR0913
    settings,
    legacy_uid,
    site_uid,
    expected_uid,
    has_extra_num,
    term,
    year,
    expected_id,
    hide_download,
):
    """transform_course should return expected data"""
    settings.OCW_BASE_URL = "http://test.edu/"
    settings.OCW_OFFLINE_DELIVERY = True
    with Path.open(
        Path(__file__).parent.parent.parent
        / "test_json/courses/16-01-unified-engineering-i-ii-iii-iv-fall-2005-spring-2006"
        / "data.json"
    ) as inf:
        course_json = json.load(inf)

    course_json["term"] = term
    course_json["year"] = year
    course_json["legacy_uid"] = legacy_uid
    course_json["site_uid"] = site_uid
    course_json["hide_download"] = hide_download
    course_json["extra_course_numbers"] = "1, 2" if has_extra_num else None
    extracted_json = {
        **course_json,
        "last_modified": now_in_utc(),
        "slug": "slug",
        "url": "http://test.edu/slug",
    }
    expected_delivery = [LearningResourceDelivery.online.name] + (
        [] if hide_download else [LearningResourceDelivery.offline.name]
    )
    transformed_json = transform_course(extracted_json)
    if expected_uid:
        assert transformed_json["ocw_topics"] == [
            "Anthropology",
            "Ethnography",
            "Humanities",
            "Philosophy",
            "Political Philosophy",
            "Social Science",
        ]
        assert transformed_json["readable_id"] == expected_id
        assert transformed_json["etl_source"] == ETLSource.ocw.name
        assert transformed_json["delivery"] == expected_delivery
        assert transformed_json["runs"][0]["run_id"] == expected_uid
        assert transformed_json["runs"][0]["level"] == ["undergraduate", "high_school"]
        assert transformed_json["runs"][0]["semester"] == (term if term else None)
        assert transformed_json["runs"][0]["year"] == (year if year else None)
        assert transformed_json["license_cc"] is True
        assert transformed_json["runs"][0]["delivery"] == expected_delivery
        assert transformed_json["runs"][0]["availability"] == Availability.anytime.name
        assert transformed_json["availability"] == Availability.anytime.name
        assert transformed_json["runs"][0]["pace"] == [Pace.self_paced.name]
        assert transformed_json["runs"][0]["format"] == [Format.asynchronous.name]
        assert transformed_json["pace"] == [Pace.self_paced.name]
        assert transformed_json["format"] == [Format.asynchronous.name]
        assert transformed_json["description"] == clean_data(
            course_json["course_description_html"]
        )
        assert (
            transformed_json["image"]["url"]
            == "http://test.edu/courses/16-01-unified-engineering-i-ii-iii-iv-fall-2005-spring-2006/8f56bbb35d0e456dc8b70911bec7cd0d_16-01f05.jpg"
        )
        assert (
            transformed_json["image"]["alt"]
            == "Illustration of an aircraft wing showing connections between the"
            " disciplines of the course."
        )
        assert transformed_json["course"]["course_numbers"][0] == {
            "value": "16.01",
            "department": {"department_id": "16", "name": DEPARTMENTS["16"]},
            "listing_type": CourseNumberType.primary.value,
            "primary": True,
            "sort_coursenum": "16.01",
        }
        assert transformed_json["course"]["course_numbers"][1:] == (
            [
                {
                    "value": "1",
                    "department": {"department_id": "1", "name": DEPARTMENTS["1"]},
                    "listing_type": CourseNumberType.cross_listed.value,
                    "primary": False,
                    "sort_coursenum": "01",
                },
                {
                    "value": "2",
                    "department": {"department_id": "2", "name": DEPARTMENTS["2"]},
                    "listing_type": CourseNumberType.cross_listed.value,
                    "primary": False,
                    "sort_coursenum": "02",
                },
            ]
            if has_extra_num
            else []
        )
    else:
        assert transformed_json is None


@pytest.mark.parametrize("has_learn_topics", [True, False])
def test_parse_topics(mocker, has_learn_topics):
    """Topics should be assigned correctly based on mitlearn topics if present, ocw topics if not"""
    ocw_topics = [
        ["Social Science", "Anthropology", "Ethnography"],
        ["Social Science", "Political Science", "International Relations"],
    ]
    mit_learn_topics = (
        [["Social Sciences", "Anthropology"], ["Social Sciences", "Political Science"]]
        if has_learn_topics
        else []
    )
    course_data = {
        "topics": ocw_topics,
        "mit_learn_topics": mit_learn_topics,
    }
    mocker.patch(
        "learning_resources.etl.utils.load_offeror_topic_map",
        return_value={
            "Political Philosophy": ["Philosophy"],
            "Ethnography": ["Anthropology"],
            "International Relations": ["Political Science"],
        },
    )
    for topic in ("Social Sciences", "Anthropology", "Political Science"):
        LearningResourceTopicFactory.create(name=topic)
    topics_dict = parse_learn_topics(course_data)
    if has_learn_topics:
        assert topics_dict == [
            {"name": "Anthropology"},
            {"name": "Political Science"},
            {"name": "Social Sciences"},
        ]
    else:
        assert topics_dict == [
            {"name": "Anthropology"},
            {"name": "Anthropology"},
            {"name": "Political Science"},
            {"name": "Political Science"},
        ]
