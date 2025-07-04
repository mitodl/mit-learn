"""ETL utils test"""

import datetime
import pathlib
import zipfile
from decimal import Decimal
from random import randrange
from subprocess import check_call
from tempfile import TemporaryDirectory

import pytest

from learning_resources.constants import (
    CONTENT_TYPE_FILE,
    CURRENCY_USD,
    LearningResourceDelivery,
    LearningResourceType,
    OfferedBy,
    PlatformType,
    RunStatus,
)
from learning_resources.etl import utils
from learning_resources.etl.canvas import parse_canvas_settings, run_for_canvas_archive
from learning_resources.etl.constants import CommitmentConfig, DurationConfig, ETLSource
from learning_resources.etl.utils import parse_certification, parse_string_to_int
from learning_resources.factories import (
    ContentFileFactory,
    LearningResourceFactory,
    LearningResourceOfferorFactory,
    LearningResourceRunFactory,
    LearningResourceTopicFactory,
)
from learning_resources.models import LearningResource

pytestmark = pytest.mark.django_db


@pytest.fixture
def canvas_settings_zip(tmp_path):
    # Create a minimal XML for course_settings.xml
    xml_content = b"""<?xml version="1.0" encoding="UTF-8"?>
    <course>
        <title>Test Course Title</title>
        <course_code>TEST-101</course_code>
        <other_field>Other Value</other_field>
    </course>
    """
    zip_path = tmp_path / "test_canvas_course.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("course_settings/course_settings.xml", xml_content)
    return zip_path


def get_olx_test_docs():
    """Get a list of edx docs from a sample archive file"""
    script_dir = pathlib.Path(__file__).parent.absolute().parent.parent
    with TemporaryDirectory() as temp:
        check_call(  # noqa: S603
            [  # noqa: S607
                "tar",
                "xf",
                pathlib.Path(script_dir, "test_json", "exported_courses_12345.tar.gz"),
            ],
            cwd=temp,
        )
        check_call(  # noqa: S603
            ["tar", "xf", "content-devops-0001.tar.gz"],  # noqa: S607
            cwd=temp,
        )

        olx_path = pathlib.Path(temp, "content-devops-0001")
        return list(utils.documents_from_olx(str(olx_path)))


@pytest.mark.parametrize("has_bucket", [True, False])
@pytest.mark.parametrize("metadata", [None, {"foo": "bar"}])
def test_sync_s3_text(mock_ocw_learning_bucket, has_bucket, metadata):
    """
    Verify data is saved to S3 if a bucket and metadata are provided
    """
    key = "fake_key"
    utils.sync_s3_text(
        mock_ocw_learning_bucket.bucket if has_bucket else None, key, metadata
    )
    s3_objects = list(
        mock_ocw_learning_bucket.bucket.objects.filter(Prefix=f"extracts/{key}")
    )
    assert len(s3_objects) == (1 if has_bucket and metadata is not None else 0)


@pytest.mark.parametrize("token", ["abc123", "", None])
@pytest.mark.parametrize("ocr_strategy", ["no_ocr", "ocr_and_text_extraction", None])
@pytest.mark.parametrize("data", [b"data", b"", None])
@pytest.mark.parametrize("headers", [None, {"a": "header"}])
def test_extract_text_metadata(  # noqa: PLR0913
    mocker, settings, data, token, ocr_strategy, headers
):
    """
    Verify that tika is called and returns a response
    """
    settings.TIKA_TIMEOUT = 120
    settings.TIKA_ACCESS_TOKEN = token
    settings.TIKA_OCR_STRATEGY = ocr_strategy
    mock_response = {"metadata": {"Author:": "MIT"}, "content": "Extracted text"}
    mock_tika = mocker.patch(
        "learning_resources.etl.utils.tika_parser.from_buffer",
        return_value=mock_response,
    )
    response = utils.extract_text_metadata(data, other_headers=headers)

    expected_headers = {"X-Tika-PDFOcrStrategy": ocr_strategy} if ocr_strategy else {}
    expected_options = {"timeout": 120, "verify": True}

    if token:
        expected_headers["X-Access-Token"] = token
    if headers:
        expected_headers = {**expected_headers, **headers}
    expected_options["headers"] = expected_headers

    if data:
        assert response == mock_response
        mock_tika.assert_called_once_with(data, requestOptions=expected_options)
    else:
        assert response is None
        mock_tika.assert_not_called()


@pytest.mark.parametrize("content", ["text", None])
def test_extract_text_from_url(mocker, content):
    """extract_text_from_url should make appropriate requests and calls to extract_text_metadata"""
    mime_type = "application/pdf"
    url = "http://test.edu/file.pdf"
    mock_request = mocker.patch(
        "learning_resources.etl.utils.requests.get",
        return_value=mocker.Mock(content=content),
    )
    mock_extract = mocker.patch("learning_resources.etl.utils.extract_text_metadata")
    utils.extract_text_from_url(url, mime_type=mime_type)

    mock_request.assert_called_once_with(url, timeout=30)
    if content:
        mock_extract.assert_called_once_with(
            content, other_headers={"Content-Type": mime_type}
        )


@pytest.mark.parametrize(
    ("text", "readable_id"),
    [
        (
            "The cat sat on the mat",
            "the-cat-sat-on-the-mat65e998f1508038ccb0e8afbb2fe10b7b",
        ),
        (
            "the dog chased a hog",
            "the-dog-chased-a-hog0adcc86118883d4b8bf121c4a0e036d6",
        ),
    ],
)
def test_generate_readable_id(text, readable_id):
    """Test that the same readable_id is always created for a given string"""
    assert utils.generate_readable_id(text) == readable_id


def test_strip_extra_whitespace():
    """Test that extra whitespace is removed from text"""
    text = " This\n\n is      a\t\ttest. "
    assert utils.strip_extra_whitespace(text) == "This is a test."


def test_parse_dates():
    """Test that parse_dates returns correct dates"""
    for datestring in ("May 13-30, 2020", "May 13 - 30,2020"):
        assert utils.parse_dates(datestring) == (
            datetime.datetime(2020, 5, 13, 12, tzinfo=datetime.UTC),
            datetime.datetime(2020, 5, 30, 12, tzinfo=datetime.UTC),
        )
    for datestring in ("Jun 24-Aug 11, 2020", "Jun  24 -  Aug 11,    2020"):
        assert utils.parse_dates(datestring) == (
            datetime.datetime(2020, 6, 24, 12, tzinfo=datetime.UTC),
            datetime.datetime(2020, 8, 11, 12, tzinfo=datetime.UTC),
        )
    for datestring in ("Nov 25, 2020-Jan 26, 2021", "Nov 25,2020  -Jan   26,2021"):
        assert utils.parse_dates(datestring) == (
            datetime.datetime(2020, 11, 25, 12, tzinfo=datetime.UTC),
            datetime.datetime(2021, 1, 26, 12, tzinfo=datetime.UTC),
        )
    assert utils.parse_dates("This is not a date") is None


@pytest.mark.parametrize("has_metadata", [True, False])
@pytest.mark.parametrize("matching_edx_module_id", [True, False])
@pytest.mark.parametrize("overwrite", [True, False])
@pytest.mark.parametrize("folder", ["folder", "static"])
@pytest.mark.parametrize("tika_content", ["tika'ed text", ""])
def test_transform_content_files(  # noqa: PLR0913
    mocker, folder, has_metadata, matching_edx_module_id, overwrite, tika_content
):
    """transform_content_files"""
    run = LearningResourceRunFactory.create(published=True)
    document = "some text in the document"
    file_extension = ".pdf" if folder == "static" else ".html"
    content_type = "course"
    archive_checksum = "7s35721d1647f962d59b8120a52210a7"
    metadata = {"title": "the title of the course"} if has_metadata else None
    tika_output = {"content": tika_content, "metadata": metadata}

    if folder == "static":
        edx_module_id = (
            f"asset-v1:{run.run_id.replace('course-v1:', '')}+type@asset+block@uuid.pdf"
        )
    else:
        edx_module_id = (
            f"block-v1:{run.run_id.replace('course-v1:', '')}+type@folder+block@uuid"
        )

    if matching_edx_module_id:
        ContentFileFactory.create(
            content="existing content",
            content_title=metadata["title"] if metadata else "",
            content_type=content_type,
            published=True,
            run=run,
            archive_checksum=archive_checksum,
            key=edx_module_id,
        )

    documents_mock = mocker.patch(
        "learning_resources.etl.utils.documents_from_olx",
        return_value=[
            (
                document,
                {
                    "content_type": content_type,
                    "archive_checksum": archive_checksum,
                    "file_extension": file_extension,
                    "source_path": f"root/{folder}/uuid{file_extension}",
                },
            )
        ],
    )
    extract_mock = mocker.patch(
        "learning_resources.etl.utils.extract_text_metadata", return_value=tika_output
    )

    script_dir = (pathlib.Path(__file__).parent.absolute()).parent.parent

    content = list(
        utils.transform_content_files(
            pathlib.Path(script_dir, "test_json", "exported_courses_12345.tar.gz"),
            run,
            overwrite=overwrite,
        )
    )

    if tika_content or (matching_edx_module_id and not overwrite):
        assert content == [
            {
                "content": "existing content"
                if (matching_edx_module_id and not overwrite)
                else tika_output["content"],
                "key": edx_module_id,
                "published": True,
                "content_title": metadata["title"] if has_metadata else "",
                "content_type": content_type,
                "archive_checksum": archive_checksum,
                "file_extension": file_extension,
                "source_path": f"root/{folder}/uuid{file_extension}",
                "edx_module_id": edx_module_id,
            }
        ]
    else:
        assert content == []

    if matching_edx_module_id and not overwrite:
        extract_mock.assert_not_called()
    else:
        extract_mock.assert_called_once_with(document, other_headers={})
    assert documents_mock.called is True


def test_documents_from_olx():
    """Test for documents_from_olx"""
    parsed_documents = get_olx_test_docs()
    assert len(parsed_documents) == 92

    formula2do = next(
        doc
        for doc in parsed_documents
        if doc[1]["source_path"].endswith("formula2do.xml")
    )
    assert formula2do[0] == b'<html filename="formula2do" display_name="To do list"/>\n'
    assert formula2do[1]["source_path"].endswith("formula2do.xml")
    assert formula2do[1]["content_type"] == CONTENT_TYPE_FILE
    assert formula2do[1]["mime_type"].endswith("/xml")


@pytest.mark.parametrize(
    "platform", [PlatformType.mitxonline.name, PlatformType.xpro.name]
)
def test_get_learning_course_bucket(
    aws_settings, mock_mitx_learning_bucket, mock_xpro_learning_bucket, platform
):  # pylint: disable=unused-argument
    """The correct bucket should be returned by the function"""
    assert utils.get_learning_course_bucket(platform).name == (
        aws_settings.MITX_ONLINE_LEARNING_COURSE_BUCKET_NAME
        if platform == PlatformType.mitxonline.name
        else aws_settings.XPRO_LEARNING_COURSE_BUCKET_NAME
    )


@pytest.mark.parametrize(
    ("readable_id", "is_ocw", "dept_ids"),
    [
        ("MITx+7.03.2x", False, ["7"]),
        ("course-v1:MITxT+21A.819.2x", False, ["21A"]),
        ("11.343", True, ["11"]),
        ("21W.202", True, ["CMS-W"]),
        ("21H.331", True, ["21H"]),
        ("course-v1:MITxT+123.658.2x", False, []),
        ("MITx+CITE101x", False, []),
        ("RanD0mStr1ng", False, []),
    ],
)
def test_extract_valid_department_from_id(readable_id, is_ocw, dept_ids):
    """Test that correct department is extracted from ID"""
    assert (
        utils.extract_valid_department_from_id(readable_id, is_ocw=is_ocw) == dept_ids
    )


def test_most_common_topics():
    """Test that most_common_topics returns the correct topics"""
    max_topics = 4
    common_topics = LearningResourceTopicFactory.create_batch(max_topics)
    uncommon_topics = LearningResourceTopicFactory.create_batch(3)
    resources = []
    for topic in common_topics:
        resources.extend(
            LearningResourceFactory.create_batch(randrange(2, 4), topics=[topic])  # noqa: S311
        )
    resources.extend(
        [LearningResourceFactory.create(topics=[topic]) for topic in uncommon_topics]
    )
    assert sorted(
        [
            topic["name"]
            for topic in utils.most_common_topics(resources, max_topics=max_topics)
        ]
    ) == [topic.name for topic in common_topics]


@pytest.mark.parametrize(
    ("original", "expected"),
    [
        (None, LearningResourceDelivery.online.name),
        (LearningResourceDelivery.online.value, LearningResourceDelivery.online.name),
        ("Blended", LearningResourceDelivery.hybrid.name),
        ("In person", LearningResourceDelivery.in_person.name),
    ],
)
def test_parse_format(original, expected):
    """parse_format should return expected format"""
    assert utils.transform_delivery(original) == [expected]


def test_parse_bad_format(mocker):
    """An exception log should be called for invalid formats"""
    mock_log = mocker.patch("learning_resources.etl.utils.log.exception")
    assert utils.transform_delivery("bad_format") == [
        LearningResourceDelivery.online.name
    ]
    mock_log.assert_called_once_with("Invalid delivery %s", "bad_format")


@pytest.mark.parametrize(
    ("offered_by", "status", "has_cert"),
    [
        (
            OfferedBy.ocw.name,
            RunStatus.archived.value,
            False,
        ),
        (
            OfferedBy.ocw.name,
            RunStatus.current.value,
            False,
        ),
        (
            OfferedBy.mitx.name,
            RunStatus.archived.value,
            False,
        ),
        (
            OfferedBy.mitx.name,
            RunStatus.current.value,
            True,
        ),
        (
            OfferedBy.mitx.name,
            RunStatus.upcoming.value,
            True,
        ),
    ],
)
def test_parse_certification(offered_by, status, has_cert):
    """The parse_certification function should return the expected bool value"""
    offered_by_obj = LearningResourceOfferorFactory.create(code=offered_by)

    resource = LearningResourceRunFactory.create(
        learning_resource=LearningResourceFactory.create(
            published=True,
            resource_type=LearningResourceType.podcast.name,
            offered_by=offered_by_obj,
        ),
    ).learning_resource
    assert resource.runs.count() == 1
    runs = [{"status": status, **run} for run in resource.runs.all().values()]
    assert parse_certification(offered_by_obj.code, runs) == has_cert


@pytest.mark.parametrize(
    ("previous_archive", "identical"),
    [
        ("test_json/course-v1:MITxT+8.01.3x+3T2022_no_change.tar.gz", True),
        ("test_json/course-v1:MITxT+8.01.3x+3T2022_minor_change.tar.gz", False),
    ],
)
def test_calc_checksum(previous_archive, identical):
    """
    calc_checksum should be able to accurately identify identical vs different archives.
    All 3 tar.gz files created on OSX from the same directory.  One archive has a minor
    text change in one file, "400" to "500".
    """
    reference_checksum = utils.calc_checksum(
        "test_json/course-v1:MITxT+8.01.3x+3T2022.tar.gz"
    )
    assert (utils.calc_checksum(previous_archive) == reference_checksum) is identical


@pytest.mark.parametrize(
    ("dept_name", "dept_id"), [("Biology", "7"), ("Metaphysics", None)]
)
def test_get_department_id_by_name(dept_name, dept_id):
    """Test that the correct department ID (if any) is returned"""
    assert utils.get_department_id_by_name(dept_name) == dept_id


@pytest.mark.parametrize(
    ("duration_str", "expected"),
    [
        ("1:00:00", "PT1H"),
        ("1:30:04", "PT1H30M4S"),
        ("00:00", "PT0S"),
        ("00:00:00", "PT0S"),
        ("00:01:00", "PT1M"),
        ("01:00:00", "PT1H"),
        ("00:00:01", "PT1S"),
        ("02:59", "PT2M59S"),
        ("72:59", "PT1H12M59S"),
        ("3675", "PT1H1M15S"),
        ("5", "PT5S"),
        ("PT1H30M4S", "PT1H30M4S"),
        ("", None),
        (None, None),
        ("bad_duration", None),
        ("PTBarnum", None),
    ],
)
def test_parse_duration(mocker, duration_str, expected):
    """Test that parse_duration returns the expected duration"""
    mock_warn = mocker.patch("learning_resources.etl.utils.log.warning")
    assert utils.iso8601_duration(duration_str) == expected
    assert mock_warn.call_count == (1 if duration_str and expected is None else 0)


@pytest.mark.parametrize(
    ("amount", "currency", "valid_currency"),
    [
        (410.52, "EUR", True),
        (100.00, "USD", True),
        (200.00, "YYY", False),
    ],
)
def test_transform_price(amount, currency, valid_currency):
    """Test that transform_price returns the expected price"""
    assert utils.transform_price(Decimal(amount), currency) == {
        "amount": amount,
        "currency": currency if valid_currency else CURRENCY_USD,
    }


def test_text_from_srt_content():
    """Test that text_from_srt_content returns expected text"""
    srt_content = (
        "1\n"
        "00:00:00,000 --> 00:00:02,000\n"
        "This is the first subtitle."
        "\n"
        "2\n"
        "00:00:02,000 --> 00:00:04,000\n"
        "This is the second subtitle."
    )
    assert utils.text_from_srt_content(srt_content) == (
        "This is the first subtitle.\nThis is the second subtitle."
    )


def test_text_from_sjson_content():
    """Test that text_from_sjson_content returns expected text"""
    sjson_content = """
        {
            "start": [0,2],
            "end": [2,4],
            "text": ["This is the first subtitle.",
                 "This is the second subtitle."
            ]
        }
    """
    assert utils.text_from_sjson_content(sjson_content) == (
        "This is the first subtitle. This is the second subtitle."
    )


@pytest.mark.parametrize(
    ("hour", "expected"), [("3", 3), (2, 2), ("", None), ("one", None)]
)
def test_parse_string_to_int(hour, expected):
    """Test that the weekly hours are correctly parsed"""
    assert parse_string_to_int(hour) == expected


@pytest.mark.parametrize(
    ("raw_value", "min_weeks", "max_weeks"),
    [
        ("3 Days", 1, 1),  # <= 5 days == 1 week
        ("7 Days", 2, 2),  # >7 days = 2 weeks
        ("4 to 8 Days", 1, 2),
        ("3-4 Weeks, no weekends", 3, 4),
        ("5 - 6 MoNths", 20, 24),
        ("1 WEEK", 1, 1),
        ("1 month more or less", 4, 4),
        ("2-3 meses", 8, 12),  # 2-3 months in Spanish
        ("1 mes", 4, 4),  # 1 month in Spanish
        ("1 semana", 1, 1),  # 1 week in Spanish
        ("2 - 3 semanas", 2, 3),
        ("Unparseable duration", None, None),
        ("", None, None),
        ("2 days in person+3 live webinars", 1, 1),
        ("2 weeks in person+3 live webinars", 2, 2),
    ],
)
def test_parse_resource_duration(raw_value, min_weeks, max_weeks):
    """Test that parse_resource_duration returns the expected min/max weeks"""
    assert utils.parse_resource_duration(raw_value) == DurationConfig(
        duration=raw_value, min_weeks=min_weeks, max_weeks=max_weeks
    )


@pytest.mark.parametrize(
    ("raw_value", "min_hours", "max_hours"),
    [
        ("5 Hours", 5, 5),
        ("3-4 Hours per Week", 3, 4),
        ("15 - 16 Hours per Week", 15, 16),
        ("5-8 hrs per week", 5, 8),
        ("5 - 10", 5, 10),
        ("5 to 10", 5, 10),
        ("6 horas", 6, 6),
        ("1 hour", 1, 1),
        ("1 hora", 1, 1),
        ("", None, None),
    ],
)
def test_parse_resource_commitment(raw_value, min_hours, max_hours):
    """Test that parse_resource_commitment returns the expected min/max hours"""
    assert utils.parse_resource_commitment(raw_value) == CommitmentConfig(
        commitment=raw_value, min_weekly_hours=min_hours, max_weekly_hours=max_hours
    )


def test_parse_canvas_settings_returns_expected_dict(canvas_settings_zip):
    """
    Test that parse_canvas_settings returns a dictionary with expected attributes
    """
    attrs = parse_canvas_settings(canvas_settings_zip)
    assert attrs["title"] == "Test Course Title"
    assert attrs["course_code"] == "TEST-101"
    assert attrs["other_field"] == "Other Value"


def test_parse_canvas_settings_missing_fields(tmp_path):
    """
    Test that parse_canvas_settings handles missing fields gracefully
    """
    xml_content = b"""<course><title>Only Title</title></course>"""
    zip_path = tmp_path / "test_canvas_course2.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("course_settings/course_settings.xml", xml_content)
    attrs = parse_canvas_settings(zip_path)
    assert attrs["title"] == "Only Title"
    assert "course_code" not in attrs


def test_parse_canvas_settings_handles_namespaces(tmp_path):
    """
    Test that parse_canvas_settings can handle XML with namespaces
    """
    xml_content = b"""<ns0:course xmlns:ns0="http://example.com">
        <ns0:title>Namespaced Title</ns0:title>
        <ns0:course_code>NS-101</ns0:course_code>
    </ns0:course>"""
    zip_path = tmp_path / "test_canvas_course4.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("course_settings/course_settings.xml", xml_content)
    attrs = parse_canvas_settings(zip_path)
    assert attrs["title"] == "Namespaced Title"
    assert attrs["course_code"] == "NS-101"


@pytest.mark.django_db
def test_run_for_canvas_archive_creates_resource_and_run(tmp_path, mocker):
    """
    Test that run_for_canvas_archive creates a LearningResource and Run
    when given a valid canvas archive.
    """
    mocker.patch(
        "learning_resources.etl.canvas.parse_canvas_settings",
        return_value={"title": "Test Course", "course_code": "TEST101"},
    )
    mocker.patch("learning_resources.etl.canvas.calc_checksum", return_value="abc123")
    # No resource exists yet
    course_archive_path = tmp_path / "archive.zip"
    course_archive_path.write_text("dummy")
    run = run_for_canvas_archive(course_archive_path, overwrite=True)
    resource = LearningResource.objects.get(readable_id="TEST101")
    assert resource.title == "Test Course"
    assert resource.etl_source == ETLSource.canvas.name
    assert resource.resource_type == LearningResourceType.course.name
    assert run is not None
    assert run.learning_resource == resource
    assert run.checksum == "abc123"


@pytest.mark.django_db
def test_run_for_canvas_archive_creates_run_if_none_exists(tmp_path, mocker):
    """
    Test that run_for_canvas_archive creates a Run if no runs exist for the resource.
    """
    mocker.patch(
        "learning_resources.etl.canvas.parse_canvas_settings",
        return_value={"title": "Test Course", "course_code": "TEST104"},
    )
    mocker.patch(
        "learning_resources.etl.canvas.calc_checksum", return_value="checksum104"
    )
    # Create resource with no runs
    resource = LearningResourceFactory.create(
        readable_id="TEST104",
        title="Test Course",
        etl_source=ETLSource.canvas.name,
        resource_type=LearningResourceType.course.name,
        published=False,
    )
    resource.runs.all().delete()
    assert resource.runs.count() == 0
    course_archive_path = tmp_path / "archive4.zip"
    course_archive_path.write_text("dummy")
    run = run_for_canvas_archive(course_archive_path, overwrite=True)
    assert run is not None
    assert run.learning_resource == resource
    assert run.checksum == "checksum104"
