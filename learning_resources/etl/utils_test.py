"""ETL utils test"""

import datetime
import pathlib
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
    RunStatus,
)
from learning_resources.etl import utils
from learning_resources.etl.constants import CommitmentConfig, DurationConfig, ETLSource
from learning_resources.etl.utils import (
    get_s3_prefix_for_source,
    parse_certification,
    parse_string_to_int,
)
from learning_resources.factories import (
    ContentFileFactory,
    LearningResourceFactory,
    LearningResourceOfferorFactory,
    LearningResourceRunFactory,
    LearningResourceTopicFactory,
)

pytestmark = pytest.mark.django_db


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
        check_call(
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
    mocker,
    folder,
    has_metadata,
    matching_edx_module_id,
    overwrite,
    tika_content,
    settings,
):
    """transform_content_files"""
    settings.SKIP_TIKA = False
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

    # Mock the new functions called by process_olx_path
    video_metadata = {"test": "video"}
    test_url = "https://example.com/test"

    mocker.patch(
        "learning_resources.etl.utils.get_video_metadata", return_value=video_metadata
    )
    mocker.patch(
        "learning_resources.etl.utils.get_url_from_module_id", return_value=test_url
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
                "title": metadata["title"] if has_metadata else "Uuid",
                "key": edx_module_id,
                "published": True,
                "content_title": metadata["title"] if has_metadata else "",
                "content_type": content_type,
                "archive_checksum": archive_checksum,
                "file_extension": file_extension,
                "source_path": f"root/{folder}/uuid{file_extension}",
                "edx_module_id": edx_module_id,
                "url": test_url,
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
    ("etl_source", "expected_setting"),
    [
        (ETLSource.mit_edx.name, "EDX_COURSE_BUCKET_PREFIX"),
        (ETLSource.xpro.name, "XPRO_COURSE_BUCKET_PREFIX"),
        (ETLSource.mitxonline.name, "MITX_ONLINE_COURSE_BUCKET_PREFIX"),
        (ETLSource.oll.name, "OLL_COURSE_BUCKET_PREFIX"),
        (ETLSource.canvas.name, "CANVAS_COURSE_BUCKET_PREFIX"),
    ],
)
def test_get_s3_prefix_for_source(settings, etl_source, expected_setting):
    """Test that get_s3_prefix_for_source returns correct prefix for each ETL source"""
    expected_prefix = getattr(settings, expected_setting)
    assert get_s3_prefix_for_source(etl_source) == expected_prefix


@pytest.mark.parametrize(
    "invalid_source",
    [
        "invalid_source",
        "ocw",  # OCW is not in the mapping
        "",
        "MITX_ONLINE",  # wrong case
    ],
)
def test_get_s3_prefix_for_source_invalid(invalid_source):
    """Test that get_s3_prefix_for_source raises ValueError for invalid sources"""
    with pytest.raises(
        ValueError, match=f"No S3 prefix found for ETL source: {invalid_source}"
    ):
        get_s3_prefix_for_source(invalid_source)


def test_get_bucket_by_name(aws_settings, mock_course_archive_bucket):  # pylint: disable=unused-argument
    """The correct bucket should be returned by the function"""
    assert utils.get_bucket_by_name(aws_settings.COURSE_ARCHIVE_BUCKET_NAME) == (
        mock_course_archive_bucket.bucket
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


@pytest.mark.parametrize(
    ("uuid_string", "expected"),
    [
        ("550e8400-e29b-41d4-a716-446655440000", True),
        ("123e4567e89b12d3a456426614174000", True),
        ("not-a-uuid", False),
        ("", False),
        ("123", False),
        ("550e8400-e29b-41d4-a716", False),  # too short
        ("550e8400e29b41d4a71644665544000g", False),  # invalid character
    ],
)
def test_is_valid_uuid(uuid_string, expected):
    """Test that is_valid_uuid correctly validates UUID strings"""
    assert utils.is_valid_uuid(uuid_string) == expected


@pytest.mark.parametrize(
    ("xml_content", "file_name", "expected_mapping"),
    [
        (
            """<video url_name="test_video">
                <transcript src="test_transcript.srt" />
                <transcript src="test_transcript_es.srt" />
            </video>""",
            "test_video.xml",
            {
                "asset-v1:test_run+type@asset+block@test_transcript.srt": {
                    "module_id": "block-v1:test_run+type@video+block@test_video",
                    "title": None,
                },
                "asset-v1:test_run+type@asset+block@test_transcript_es.srt": {
                    "module_id": "block-v1:test_run+type@video+block@test_video",
                    "title": None,
                },
            },
        ),
        (
            """<video url_name="another_video">
                <transcript src="another_transcript.srt" />
            </video>""",
            "another_video.xml",
            {
                "asset-v1:test_run+type@asset+block@another_transcript.srt": {
                    "module_id": "block-v1:test_run+type@video+block@another_video",
                    "title": None,
                }
            },
        ),
        (
            """<video>
                <transcript src="no_url_name.srt" />
            </video>""",
            "no_url_name.xml",
            {},  # No url_name, should return empty dict
        ),
        (
            """<video url_name="no_transcripts">
            </video>""",
            "no_transcripts.xml",
            {},  # No transcripts, should return empty dict
        ),
        (
            """invalid xml content""",
            "invalid.xml",
            {},  # Invalid XML, should return empty dict
        ),
    ],
)
def test_parse_video_transcripts_xml(mocker, xml_content, file_name, expected_mapping):
    """Test that parse_video_transcripts_xml correctly parses video XML and creates transcript mapping"""
    run = LearningResourceRunFactory.create(run_id="course-v1:test_run")
    path = mocker.Mock()
    path.__str__ = mocker.Mock(return_value=f"video/{file_name}")

    mock_log = mocker.patch("learning_resources.etl.utils.log")

    result = utils.parse_video_transcripts_xml(run, xml_content, path)

    assert result == expected_mapping

    # Check if warning/exception was logged for invalid XML
    if "invalid xml" in xml_content.lower():
        mock_log.debug.assert_called_once()


@pytest.mark.parametrize("video_dir_exists", [True, False])
def test_get_video_metadata(mocker, tmp_path, video_dir_exists):
    """Test that get_video_metadata correctly processes video directory and returns transcript mappings"""
    run = LearningResourceRunFactory.create(run_id="course-v1:test_run")
    olx_path = tmp_path / "course"
    olx_path.mkdir()

    if video_dir_exists:
        video_dir = olx_path / "video"
        video_dir.mkdir()

        # Create a test video XML file
        video_xml = """<video url_name="test_video">
            <transcript src="test_transcript1.srt" />
            <transcript src="test_transcript2.srt" />
        </video>"""

        video_file = video_dir / "test_video.xml"
        video_file.write_text(video_xml)

        # Mock parse_video_transcripts_xml to return expected mapping
        expected_mapping = {
            "asset-v1:test_run+type@asset+block@test_transcript1.srt": {
                "module_id": "block-v1:test_run+type@video+block@test_video",
                "title": None,
            },
            "asset-v1:test_run+type@asset+block@test_transcript2.srt": {
                "module_id": "block-v1:test_run+type@video+block@test_video",
                "title": None,
            },
        }
        mock_parse = mocker.patch(
            "learning_resources.etl.utils.parse_video_transcripts_xml",
            return_value=expected_mapping,
        )
        result = utils.get_video_metadata(str(olx_path), run)

        assert result == expected_mapping
        assert mock_parse.call_count == 1
        call_args = mock_parse.call_args[0]
        assert call_args[0] == run
        assert call_args[1] == video_xml
    else:
        # No video directory
        assert utils.get_video_metadata(str(olx_path), run) == {}


@pytest.mark.parametrize(
    (
        "etl_source",
        "module_id",
        "has_video_meta",
        "expected_url_pattern",
    ),
    [
        # Asset URLs
        (
            "mit_edx",
            "asset-v1:test+type@asset+block@image.png",
            False,
            "https://edx.org/asset-v1:test+type@asset+block@image.png",
        ),
        (
            "mit_edx",
            "asset-v1:test+type@asset+block@video.mp4",
            False,
            "https://edx.org/asset-v1:test+type@asset+block@video.mp4",
        ),
        (
            "mit_edx",
            "asset-v1:test+type@asset+block@transcript.srt",
            True,
            "https://edx.org/courses/course-v1:test_run/jump_to_id/test_video",
        ),
        (
            "mit_edx",
            "asset-v1:test+type@asset+block@transcript.srt",
            False,
            "https://edx.org/asset-v1:test+type@asset+block@transcript.srt",
        ),  # SRT without video meta returns asset URL
        # Block URLs with valid UUID
        (
            "mit_edx",
            "block-v1:test+type@html+block@550e8400-e29b-41d4-a716-446655440000",
            False,
            "https://edx.org/courses/course-v1:test_run/jump_to_id/550e8400-e29b-41d4-a716-446655440000",
        ),
        # OLL source with run_id modification
        (
            "oll",
            "block-v1:test+type@html+block@550e8400-e29b-41d4-a716-446655440000",
            False,
            "https://oll.org/courses/course-v1:course-v1:test_run/jump_to_id/550e8400-e29b-41d4-a716-446655440000",
        ),
        # Invalid cases
        (
            "",
            "asset-v1:test+type@asset+block@file.txt",
            False,
            "None/asset-v1:test+type@asset+block@file.txt",
        ),  # Empty etl_source returns None as root_url
        (
            "mit_edx",
            "block-v1:test+type@html+block@invalid-uuid",
            False,
            None,
        ),  # Invalid UUID
        ("mit_edx", "unknown-format", False, None),  # Unknown format
    ],
)
def test_get_url_from_module_id(
    settings,
    etl_source,
    module_id,
    has_video_meta,
    expected_url_pattern,
):
    """Test that get_url_from_module_id generates correct URLs for different module types"""
    # Setup settings
    settings.CONTENT_BASE_URL_EDX = "https://edx.org"
    settings.CONTENT_BASE_URL_OLL = "https://oll.org"

    run = LearningResourceRunFactory.create(
        run_id="course-v1:test_run", learning_resource__etl_source=etl_source
    )

    # Setup metadata
    video_srt_metadata = (
        {
            "asset-v1:test+type@asset+block@transcript.srt": {
                "module_id": "block-v1:test+type@video+block@test_video"
            }
        }
        if has_video_meta
        else None
    )

    result = utils.get_url_from_module_id(module_id, run, video_srt_metadata)

    if expected_url_pattern:
        assert result == expected_url_pattern
    else:
        assert result is None


def test_process_olx_path_malformed_sjson(mocker, settings):
    """Test that process_olx_path handles malformed SJSON content gracefully"""
    run = LearningResourceRunFactory.create(run_id="course-v1:test_run")
    olx_path = mocker.Mock()
    olx_path.__str__ = mocker.Mock(return_value="path/to/malformed_content.sjson")

    malformed_sjson_content = """{ "start": [0,2], "end": [2,4], "text": ["Valid text", "Another valid text" }"""
    metadata = {
        "content_type": CONTENT_TYPE_FILE,
        "archive_checksum": "checksum123",
        "file_extension": ".sjson",
        "source_path": "path/to/malformed_content.sjson",
    }
    mocker.patch(
        "learning_resources.etl.utils.documents_from_olx",
        return_value=[
            (
                malformed_sjson_content.encode("utf-8"),
                metadata,
            ),
        ],
    )
    tika_output = {
        "content": malformed_sjson_content.encode("utf-8"),
        "metadata": metadata,
    }
    mocker.patch(
        "learning_resources.etl.utils.extract_text_metadata", return_value=tika_output
    )

    script_dir = (pathlib.Path(__file__).parent.absolute()).parent.parent

    content = list(
        utils.transform_content_files(
            pathlib.Path(script_dir, "test_json", "exported_courses_12345.tar.gz"),
            run,
            overwrite=True,
        )
    )
    # Since the SJSON is malformed, no content should be returned
    assert content == []


def test_process_olx_path_encrypted_pdf(mocker, settings, tmp_path):
    """
    Test that process_olx_path logs an error and skips encrypted PDFs
    """
    settings.OCR_MODEL = "test_model"
    settings.SKIP_TIKA = False

    run = LearningResourceRunFactory.create()
    olx_path = tmp_path / "course"
    olx_path.mkdir()

    # Create the file so stat() works
    source_rel_path = "static/encrypted.pdf"
    full_path = olx_path / source_rel_path
    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_bytes(b"fake pdf content")

    # Mock documents_from_olx to yield this file
    mocker.patch(
        "learning_resources.etl.utils.documents_from_olx",
        return_value=[
            (
                b"fake pdf content",
                {
                    "content_type": CONTENT_TYPE_FILE,
                    "mime_type": "application/pdf",
                    "archive_checksum": "checksum",
                    "file_extension": ".pdf",
                    "source_path": source_rel_path,
                },
            )
        ],
    )

    # Mock mocks
    mocker.patch("learning_resources.etl.utils.get_video_metadata", return_value={})
    mocker.patch(
        "learning_resources.etl.utils.get_url_from_module_id",
        return_value="http://example.com",
    )
    mock_log = mocker.patch("learning_resources.etl.utils.log")

    # Mock PdfReader to raise FileNotDecryptedError
    mocker.patch(
        "learning_resources.etl.utils.PdfReader",
        side_effect=utils.FileNotDecryptedError,
    )

    results = list(
        utils.process_olx_path(
            str(olx_path),
            run,
            overwrite=True,
            use_ocr=True,
        )
    )

    assert len(results) == 0
    mock_log.exception.assert_called_with("Skipping encrypted pdf %s", full_path)


@pytest.mark.parametrize(
    (
        "content",
        "source_path",
        "edx_module_id",
        "video_srt_metadata",
        "mock_xml_content",
        "expected_title",
    ),
    [
        (
            "some content",
            "path/to/vid.srt",
            "asset-v1:mit+course+video+block@vid",
            {"asset-v1:mit+course+video+block@vid": {"title": "Video Title"}},
            None,
            "Video Title",
        ),
        (
            '<html display_name="XML Title"/>',
            "path/to/doc.xml",
            "block-v1:mit+course+type@xml+block@doc",
            None,
            None,
            "XML Title",
        ),
        (
            "<html><body>Content</body></html>",
            "html/doc.html",
            "block-v1:mit+course+type@html+block@doc",
            None,
            '<html display_name="HTML via XML Title"/>',
            "HTML via XML Title",
        ),
        (
            "<html><head><title>HTML Tag Title</title></head><body>Content</body></html>",
            "html/doc.html",
            "block-v1:mit+course+type@html+block@doc",
            None,
            None,
            "HTML Tag Title",
        ),
        (
            "<html><body>Content</body></html>",
            "html/my-file-name.html",
            "block-v1:mit+course+type@html+block@my-file-name",
            None,
            None,
            "My File Name",
        ),
    ],
)
def test_get_title_for_content(  # noqa: PLR0913
    tmp_path,
    content,
    source_path,
    edx_module_id,
    video_srt_metadata,
    mock_xml_content,
    expected_title,
):
    """Test get_title_for_content for various scenarios"""
    olx_path = tmp_path / "course"
    olx_path.mkdir()

    if mock_xml_content:
        # Create corresponding XML file
        xml_dir = olx_path / "html"
        xml_dir.mkdir(parents=True, exist_ok=True)
        xml_file = xml_dir / f"{pathlib.Path(source_path).stem}.xml"
        xml_file.write_text(mock_xml_content)

    title = utils.get_title_for_content(
        content,
        str(olx_path),
        source_path,
        edx_module_id,
        video_srt_metadata,
    )

    assert title == expected_title
