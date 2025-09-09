"""Tests for Canvas ETL functionality"""

import zipfile
from datetime import timedelta
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from defusedxml import ElementTree

from learning_resources.constants import LearningResourceType, PlatformType
from learning_resources.etl.canvas import (
    _compact_element,
    is_file_published,
    parse_canvas_settings,
    parse_files_meta,
    parse_module_meta,
    parse_web_content,
    run_for_canvas_archive,
    transform_canvas_content_files,
    transform_canvas_problem_files,
)
from learning_resources.etl.constants import ETLSource
from learning_resources.etl.utils import get_edx_module_id
from learning_resources.factories import (
    ContentFileFactory,
    LearningResourceFactory,
    LearningResourcePlatformFactory,
    LearningResourceRunFactory,
)
from learning_resources.models import LearningResource
from learning_resources_search.constants import CONTENT_FILE_TYPE
from main.utils import now_in_utc

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def canvas_platform():
    """Fixture for the canvas platform"""
    return LearningResourcePlatformFactory.create(code=PlatformType.canvas.name)


def canvas_zip_with_files(tmp_path: str, files: dict[tuple[str, bytes]]) -> str:
    """
    Create a Canvas zip with problem files in the tutorbot folder.
    `files` is a list of tuples: (filename, content_bytes)
    """
    zip_path = tmp_path / "canvas_course_with_problems.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        for filename, content in files:
            zf.writestr(filename, content)
    return zip_path


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
    course_folder = "test"
    mocker.patch(
        "learning_resources.etl.canvas.parse_canvas_settings",
        return_value={"title": "Test Course", "course_code": "TEST101"},
    )
    mocker.patch(
        "learning_resources.etl.canvas.parse_context_xml",
        return_value={"course_id": "123", "canvas_domain": "mit.edu"},
    )

    mocker.patch("learning_resources.etl.canvas.calc_checksum", return_value="abc123")
    # No resource exists yet
    zip_path = tmp_path / "archive.zip"

    _, run = run_for_canvas_archive(
        zip_path, course_folder=course_folder, overwrite=True
    )
    resource = LearningResource.objects.get(readable_id=f"{course_folder}-TEST101")
    assert resource.title == "Test Course"
    assert resource.etl_source == ETLSource.canvas.name
    assert resource.resource_type == LearningResourceType.course.name
    assert resource.platform.code == PlatformType.canvas.name
    assert run is not None
    assert run.learning_resource == resource
    assert run.checksum == "abc123"


@pytest.mark.django_db
def test_run_for_canvas_archive_creates_run_if_none_exists(tmp_path, mocker):
    """
    Test that run_for_canvas_archive creates a Run if no runs exist for the resource.
    """
    course_folder = "test"
    mocker.patch(
        "learning_resources.etl.canvas.parse_canvas_settings",
        return_value={"title": "Test Course", "course_code": "TEST104"},
    )
    mocker.patch(
        "learning_resources.etl.canvas.parse_context_xml",
        return_value={"course_id": "123", "canvas_domain": "mit.edu"},
    )
    mocker.patch(
        "learning_resources.etl.canvas.calc_checksum", return_value="checksum104"
    )
    # Create resource with no runs
    resource = LearningResourceFactory.create(
        readable_id=f"{course_folder}-TEST104",
        title="Test Course",
        etl_source=ETLSource.canvas.name,
        resource_type=LearningResourceType.course.name,
        published=False,
    )
    resource.runs.all().delete()
    assert resource.runs.count() == 0
    course_archive_path = tmp_path / "archive4.zip"
    course_archive_path.write_text("dummy")
    _, run = run_for_canvas_archive(
        course_archive_path, course_folder=course_folder, overwrite=True
    )
    assert run is not None
    assert run.learning_resource == resource
    assert run.checksum == "checksum104"


def make_canvas_zip_with_module_meta(tmp_path, module_xml, manifest_xml):
    """
    Create a zip file with module_meta.xml and imsmanifest.xml
    """
    zip_path = tmp_path / "canvas_course.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("course_settings/module_meta.xml", module_xml)
        zf.writestr("imsmanifest.xml", manifest_xml)
    return zip_path


def test_parse_module_meta_returns_active_and_unpublished(tmp_path):
    """
    Test that parse_module_meta returns active and unpublished items
    """
    module_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
    <modules xmlns="http://canvas.instructure.com/xsd/cccv1p0">
      <module>
        <title>Module 1</title>
        <items>
          <item>
            <workflow_state>active</workflow_state>
            <title>Item 1</title>
            <identifierref>RES1</identifierref>
            <content_type>resource</content_type>
          </item>
          <item>
            <workflow_state>unpublished</workflow_state>
            <title>Item 2</title>
            <identifierref>RES2</identifierref>
            <content_type>resource</content_type>
          </item>
        </items>
      </module>
    </modules>
    """
    manifest_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
    <manifest xmlns="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1">
      <resources>
        <resource identifier="RES1" type="webcontent">
          <file href="file1.html"/>
        </resource>
        <resource identifier="RES2" type="webcontent">
          <file href="file2.html"/>
        </resource>
      </resources>
      <organizations>
        <organization>
          <item identifierref="RES1">
            <title>Item 1</title>
          </item>
          <item identifierref="RES2">
            <title>Item 2</title>
          </item>
        </organization>
      </organizations>
    </manifest>
    """
    zip_path = make_canvas_zip_with_module_meta(tmp_path, module_xml, manifest_xml)
    result = parse_module_meta(zip_path)
    assert "active" in result
    assert "unpublished" in result

    assert any(
        item["title"] == "Item 1" and item["path"].name == "file1.html"
        for item in result["active"]
    )
    assert any(
        item["title"] == "Item 2" and item["path"].name == "file2.html"
        for item in result["unpublished"]
    )


def test_parse_module_meta_handles_missing_identifierref(tmp_path):
    """
    Test that parse_module_meta doesnt fail in case of missing identifierref
    """
    module_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
    <modules xmlns="http://canvas.instructure.com/xsd/cccv1p0">
      <module>
        <title>Module 2</title>
        <items>
          <item>
            <workflow_state>active</workflow_state>
            <title>Item No Ref</title>
            <content_type>resource</content_type>
          </item>
        </items>
      </module>
    </modules>
    """
    manifest_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
    <manifest xmlns="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1">
      <resources></resources>
      <organizations>
        <organization>
          <item>
            <title>Item No Ref</title>
          </item>
        </organization>
      </organizations>
    </manifest>
    """
    zip_path = make_canvas_zip_with_module_meta(tmp_path, module_xml, manifest_xml)
    result = parse_module_meta(zip_path)
    assert "active" in result
    assert len(result["active"]) == 0
    assert len(result["unpublished"]) == 0


def test_transform_canvas_content_files_removes_unpublished_content(mocker, tmp_path):
    """
    Test that transform_canvas_content_files removes content files not marked as published.
    """

    # Setup: create a fake run with some content files
    resource = LearningResourceFactory.create(etl_source=ETLSource.canvas.name)
    run = LearningResourceRunFactory.create(learning_resource=resource)

    published_path = "/test/published/file1.html"
    unpublished_path = "/test/unpublished/file2.html"
    unpublished_cf = ContentFileFactory.create(
        run=run, published=True, key=get_edx_module_id(unpublished_path, run)
    )
    module_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
    <modules xmlns="http://canvas.instructure.com/xsd/cccv1p0">
      <module>
        <title>Module 1</title>
        <items>
          <item>
            <workflow_state>active</workflow_state>
            <title>Item 1</title>
            <identifierref>RES1</identifierref>
            <content_type>resource</content_type>
          </item>
          <item>
            <workflow_state>unpublished</workflow_state>
            <title>Item 2</title>
            <identifierref>RES2</identifierref>
            <content_type>resource</content_type>
          </item>
        </items>
      </module>
    </modules>
    """
    manifest_xml = bytes(
        f"""<?xml version="1.0" encoding="UTF-8"?>
    <manifest xmlns="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1">
      <resources>
        <resource identifier="RES1" type="webcontent">
          <file href="{published_path}"/>
        </resource>
        <resource identifier="RES2" type="webcontent">
          <file href="{unpublished_path}"/>
        </resource>
      </resources>
      <organizations>
        <organization>
          <item identifierref="RES1">
            <title>Item 1</title>
          </item>
          <item identifierref="RES2">
            <title>Item 2</title>
          </item>
        </organization>
      </organizations>
    </manifest>
    """,
        "utf-8",
    )
    zip_path = tmp_path / "canvas_course.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("course_settings/module_meta.xml", module_xml)
        zf.writestr("imsmanifest.xml", manifest_xml)
        zf.writestr(published_path, "content")
        zf.writestr(unpublished_path, "content")
    mocker.patch(
        "learning_resources.etl.utils.extract_text_metadata",
        return_value={"content": "test"},
    )
    bulk_unpub = mocker.patch(
        "learning_resources.etl.canvas.bulk_resources_unpublished_actions"
    )

    # Create a fake zipfile with the published file

    list(
        transform_canvas_content_files(
            Path(zip_path), run, url_config={}, overwrite=True
        )
    )

    # Ensure unpublished content is deleted and unpublished actions called
    bulk_unpub.assert_called_once_with([unpublished_cf.id], CONTENT_FILE_TYPE)


def test_transform_canvas_problem_files_pdf_calls_pdf_to_markdown(
    tmp_path, mocker, settings
):
    """
    Test that transform_canvas_problem_files calls _pdf_to_markdown for PDF files.
    """

    settings.CANVAS_TUTORBOT_FOLDER = "tutorbot/"
    settings.CANVAS_PDF_TRANSCRIPTION_MODEL = "fake-model"
    pdf_filename = "problemset1/problem.pdf"
    pdf_content = b"%PDF-1.4 fake pdf content"
    zip_path = canvas_zip_with_files(
        tmp_path, [(f"tutorbot/{pdf_filename}", pdf_content)]
    )

    # return a file with pdf extension
    fake_file_data = {
        "run": "run",
        "content": "original pdf content",
        "archive_checksum": "checksum",
        "source_path": f"tutorbot/{pdf_filename}",
        "file_extension": ".pdf",
    }
    mocker.patch(
        "learning_resources.etl.canvas._process_olx_path",
        return_value=iter([fake_file_data]),
    )

    # Patch _pdf_to_markdown to return a known value
    pdf_to_md = mocker.patch(
        "learning_resources.etl.canvas._pdf_to_markdown",
        return_value="markdown content from pdf",
    )

    # Patch Path(olx_path) / Path(problem_file_data["source_path"]) to exist
    run = mocker.Mock()

    results = list(transform_canvas_problem_files(zip_path, run, overwrite=True))

    pdf_to_md.assert_called_once()
    assert results[0]["content"] == "markdown content from pdf"
    assert results[0]["problem_title"] == "problemset1"


def test_transform_canvas_problem_files_non_pdf_does_not_call_pdf_to_markdown(
    tmp_path, mocker, settings
):
    """
    Test that transform_canvas_problem_files does not call _pdf_to_markdown for non-PDF files.
    """
    settings.CANVAS_TUTORBOT_FOLDER = "tutorbot/"
    settings.CANVAS_PDF_TRANSCRIPTION_MODEL = "fake-model"
    html_filename = "problemset2/problem.html"
    html_content = b"<html>problem</html>"
    zip_path = canvas_zip_with_files(
        tmp_path, [(f"tutorbot/{html_filename}", html_content)]
    )

    fake_file_data = {
        "run": "run",
        "content": "original html content",
        "archive_checksum": "checksum",
        "source_path": f"tutorbot/{html_filename}",
        "file_extension": ".html",
    }
    mocker.patch(
        "learning_resources.etl.canvas._process_olx_path",
        return_value=iter([fake_file_data]),
    )

    pdf_to_md = mocker.patch("learning_resources.etl.canvas._pdf_to_markdown")

    run = mocker.Mock()

    results = list(transform_canvas_problem_files(zip_path, run, overwrite=True))

    pdf_to_md.assert_not_called()
    assert results[0]["content"] == "original html content"
    assert results[0]["problem_title"] == "problemset2"


@pytest.mark.django_db
def test_transform_canvas_content_files_url_assignment(mocker, tmp_path):
    """
    Test that transform_canvas_content_files assigns URLs based on url_config.
    """
    run = MagicMock()
    run.id = 1
    url_config = {"/folder/file1.html": "https://cdn.example.com/file1.html"}
    # Patch _process_olx_path to yield content_data with source_path
    mock_content_data = [
        {"source_path": "data/folder/file1.html", "key": "file1"},
    ]
    mocker.patch(
        "learning_resources.etl.canvas._process_olx_path",
        return_value=mock_content_data,
    )
    mocker.patch(
        "learning_resources.etl.canvas.parse_module_meta",
        return_value={"active": [], "unpublished": []},
    )
    # Use a real zip file
    course_zipfile = canvas_zip_with_files(
        tmp_path, [("folder/file1.html", "fake content")]
    )
    # Patch published_items to always match
    mocker.patch(
        "learning_resources.etl.canvas.get_edx_module_id", return_value="file1"
    )
    # Patch bulk_resources_unpublished_actions to do nothing
    mocker.patch("learning_resources.etl.canvas.bulk_resources_unpublished_actions")
    # Patch run.content_files.exclude to return a mock with delete method
    run.content_files.exclude.return_value.values_list.return_value = []
    run.content_files.exclude.return_value.delete = lambda: None

    results = list(
        transform_canvas_content_files(
            Path(course_zipfile),
            run=run,
            url_config=url_config,
            overwrite=False,
        )
    )
    file1 = next(item for item in results if item["key"] == "file1")
    assert file1["url"] == "https://cdn.example.com/file1.html"


@pytest.mark.parametrize(
    ("file_meta", "expected"),
    [
        # Test case: File is explicitly hidden
        ({"hidden": "true", "locked": "false"}, False),
        # Test case: File is explicitly locked
        ({"hidden": "false", "locked": "true"}, False),
        # Test case: File is neither hidden nor locked, visibility is "inherit"
        ({"hidden": "false", "locked": "false", "visibility": "inherit"}, True),
        # Test case: File is neither hidden nor locked, visibility is "course"
        ({"hidden": "false", "locked": "false", "visibility": "course"}, True),
        # Test case: File is neither hidden nor locked, visibility is "institution"
        ({"hidden": "false", "locked": "false", "visibility": "institution"}, True),
        # Test case: File is neither hidden nor locked, visibility is "public"
        ({"hidden": "false", "locked": "false", "visibility": "public"}, True),
        # Test case: File is neither hidden nor locked, visibility is unknown
        ({"hidden": "false", "locked": "false", "visibility": "unknown"}, False),
        # Test case: File is neither hidden nor locked, unlock_at is in the future
        (
            {
                "hidden": "false",
                "locked": "false",
                "unlock_at": (now_in_utc() + timedelta(days=1)).isoformat(),
            },
            False,
        ),
        # Test case: File is neither hidden nor locked, unlock_at is in the past
        (
            {
                "hidden": "false",
                "locked": "false",
                "unlock_at": (now_in_utc() - timedelta(days=1)).isoformat(),
            },
            True,
        ),
        # Test case: File is neither hidden nor locked, lock_at is in the future
        (
            {
                "hidden": "false",
                "locked": "false",
                "lock_at": (now_in_utc() + timedelta(days=1)).isoformat(),
            },
            True,
        ),
        # Test case: File is neither hidden nor locked, lock_at is in the past
        (
            {
                "hidden": "false",
                "locked": "false",
                "lock_at": (now_in_utc() - timedelta(days=1)).isoformat(),
            },
            False,
        ),
        # Test case: File is neither hidden nor locked, unlock_at and lock_at are valid
        (
            {
                "hidden": "false",
                "locked": "false",
                "unlock_at": (now_in_utc() - timedelta(days=1)).isoformat(),
                "lock_at": (now_in_utc() + timedelta(days=1)).isoformat(),
            },
            True,
        ),
        # Test case: File is neither hidden nor locked, unlock_at is in the future, lock_at is in the past
        (
            {
                "hidden": "false",
                "locked": "false",
                "unlock_at": (now_in_utc() + timedelta(days=1)).isoformat(),
                "lock_at": (now_in_utc() - timedelta(days=1)).isoformat(),
            },
            False,
        ),
        # Test case: File is neither hidden nor locked, unlock_at and lock_at are invalid
        (
            {
                "hidden": "false",
                "locked": "false",
                "unlock_at": "invalid_date",
                "lock_at": "invalid_date",
            },
            True,
        ),
    ],
)
def test_is_file_published(file_meta, expected):
    """
    Test is_file_published for all conditions in file metadata
    """
    assert is_file_published(file_meta) == expected


def test_published_module_and_files_meta_content_ingestion(mocker, tmp_path):
    """
    Test published files from files_meta and module_meta are retained
    """

    module_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
    <modules xmlns="http://canvas.instructure.com/xsd/cccv1p0">
      <module>
        <title>Module 1</title>
        <items>
          <item>
            <workflow_state>active</workflow_state>
            <title>Item 1</title>
            <identifierref>RES1</identifierref>
            <content_type>resource</content_type>
          </item>
          <item>
            <workflow_state>unpublished</workflow_state>
            <title>Item 2</title>
            <identifierref>RES2</identifierref>
            <content_type>resource</content_type>
          </item>
        </items>
      </module>
    </modules>
    """

    files_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
    <fileMeta xmlns="http://canvas.instructure.com/xsd/cccv1p0"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://canvas.instructure.com/xsd/cccv1p0 https://canvas.instructure.com/xsd/cccv1p0.xsd">
    <files>
    <file identifier="RES3">
      <category>uncategorized</category>
    </file>
    <file identifier="RES4">
      <locked>true</locked>
      <category>uncategorized</category>
    </file>
    </files>
    </fileMeta>
    """
    manifest_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
    <manifest xmlns="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1">
      <resources>
        <resource identifier="RES1" type="webcontent">
          <file href="file1.html"/>
        </resource>
        <resource identifier="RES2" type="webcontent">
          <file href="file2.html"/>
        </resource>
        <resource identifier="RES3" type="webcontent">
          <file href="file3.html"/>
        </resource>
        <resource identifier="RES4" type="webcontent">
          <file href="file4.html"/>
        </resource>
      </resources>
      <organizations>
        <organization>
          <item identifierref="RES1">
            <title>Item 1</title>
          </item>
          <item identifierref="RES2">
            <title>Item 2</title>
          </item>

        </organization>
      </organizations>
    </manifest>
    """

    mocker.patch(
        "learning_resources.etl.utils.extract_text_metadata",
        return_value={"content": "TEXT"},
    )
    bulk_unpub = mocker.patch(
        "learning_resources.etl.canvas.bulk_resources_unpublished_actions"
    )
    zip_path = canvas_zip_with_files(
        tmp_path,
        [
            ("course_settings/module_meta.xml", module_xml),
            ("course_settings/files_meta.xml", files_xml),
            ("imsmanifest.xml", manifest_xml),
            ("file1.html", b"<html/>"),
            ("file2html", b"<html/>"),
            ("file3.html", b"<html/>"),
            ("file4.html", b"<html/>"),
        ],
    )
    run = LearningResourceRunFactory.create()
    stale_contentfile = ContentFileFactory.create(run=run)
    results = list(
        transform_canvas_content_files(
            zip_path, run=run, url_config={}, overwrite=False
        )
    )
    result_paths = [result["source_path"] for result in results]
    assert len(results) == 2
    assert "/file1.html" in result_paths
    assert "/file3.html" in result_paths
    assert bulk_unpub.mock_calls[0].args[0] == [stale_contentfile.id]


@pytest.mark.parametrize(
    ("element", "expected"),
    [
        # Test case: Element with no children, only text
        (
            ElementTree.fromstring("""<tag>Sample Text</tag>"""),
            "Sample Text",
        ),
        # Test case: Element with children, nested structure
        (
            ElementTree.fromstring(
                """<parent>
                <child1>Child 1 Text</child1>
                <child2>
                    <subchild>Subchild Text</subchild>
                </child2>
            </parent>
        """
            ),
            {
                "child1": "Child 1 Text",
                "child2": {"subchild": "Subchild Text"},
            },
        ),
        # Test case: Element with mixed text and children
        (
            ElementTree.fromstring(
                """<mixed>Parent Text<child>Child Text</child></mixed>"""
            ),
            {
                "child": "Child Text",
            },
        ),
    ],
)
def test_compact_element(element, expected):
    """
    Test _compact_element function with nested tags.
    """
    result = _compact_element(element)
    assert result == expected


def test_parse_web_content_returns_active_and_unpublished(tmp_path):
    """
    Test that parse_web_content returns active and unpublished items
    """
    manifest_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
    <manifest xmlns="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1">
      <resources>
        <resource identifier="RES1" type="webcontent" href="file1.html">
          <file href="file1.html"/>
        </resource>
        <resource identifier="RES2" type="webcontent" href="file2.html">
          <file href="file2.html"/>
        </resource>
      </resources>
    </manifest>
    """
    html_content_active = b"""<html>
    <head><title>Active Content</title><meta name="workflow_state" content="active"></head>
    <body>Content</body>
    </html>
    """
    html_content_unpublished = b"""<html>
    <head><title>Unpublished Content</title><meta name="workflow_state" content="unpublished"></head>
    <body>Content</body>
    </html>
    """
    zip_path = tmp_path / "canvas_course.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("imsmanifest.xml", manifest_xml)
        zf.writestr("file1.html", html_content_active)
        zf.writestr("file2.html", html_content_unpublished)

    result = parse_web_content(zip_path)
    assert "active" in result
    assert "unpublished" in result

    assert any(
        item["title"] == "Active Content" and item["path"] == "file1.html"
        for item in result["active"]
    )
    assert any(
        item["title"] == "Unpublished Content" and item["path"] == "file2.html"
        for item in result["unpublished"]
    )


def test_parse_web_content_handles_missing_workflow_state(tmp_path):
    """
    Test that parse_web_content handles missing workflow_state gracefully
    """
    manifest_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
    <manifest xmlns="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1">
      <resources>
        <resource identifier="RES1" type="webcontent" href="file1.html">
          <file href="file1.html"/>
        </resource>
      </resources>
    </manifest>
    """
    html_content = b"""<html>
    <head><title>No Workflow State</title></head>
    <body>Content</body>
    </html>
    """
    zip_path = tmp_path / "canvas_course.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("imsmanifest.xml", manifest_xml)
        zf.writestr("file1.html", html_content)

    result = parse_web_content(zip_path)
    assert "active" in result
    assert "unpublished" in result
    assert len(result["active"]) == 0
    assert len(result["unpublished"]) == 1
    assert result["unpublished"][0]["title"] == "No Workflow State"
    assert result["unpublished"][0]["path"] == "file1.html"


def test_parse_web_content_excludes_instructor_only_content(tmp_path):
    """
    Test that parse_web_content excludes content intended for Instructors only
    """
    manifest_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
    <manifest xmlns="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1">
      <resources>
        <resource identifier="RES1" type="webcontent" href="file1.html">
          <file href="file1.html"/>
          <metadata>
            <lom>
              <educational>
                <intendedEndUserRole>
                  <value>Instructor</value>
                </intendedEndUserRole>
              </educational>
            </lom>
          </metadata>
        </resource>
      </resources>
    </manifest>
    """
    html_content = b"""<html>
    <head><title>Instructor Only Content</title><meta name="workflow_state" content="active"></head>
    <body>Content</body>
    </html>
    """
    zip_path = tmp_path / "canvas_course.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("imsmanifest.xml", manifest_xml)
        zf.writestr("file1.html", html_content)

    result = parse_web_content(zip_path)
    assert "active" in result
    assert "unpublished" in result
    assert len(result["active"]) == 0
    assert len(result["unpublished"]) == 1
    assert result["unpublished"][0]["title"] == "Instructor Only Content"
    assert result["unpublished"][0]["path"] == "file1.html"


def test_parse_files_meta_excludes_tutorbot_folder(tmp_path, settings):
    """
    Test that parse_files_meta explicitly excludes files in the tutorbot folder
    even if they are marked as published in the files_meta.xml.
    """
    settings.CANVAS_TUTORBOT_FOLDER = "web_resources/ai/tutor/"
    files_meta_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
    <files xmlns="http://canvas.instructure.com/xsd/cccv1p0">
      <file identifier="file1">
        <display_name>Published File</display_name>
        <hidden>false</hidden>
        <locked>false</locked>
        <path>web_resources/ai/tutor/tutorfile.html</path>
      </file>
      <file identifier="file2">
        <display_name>Regular File</display_name>
        <hidden>false</hidden>
        <locked>false</locked>
        <path>regular_folder/file2.html</path>
      </file>
    </files>
    """
    manifest_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
    <manifest xmlns="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1">
      <resources>
        <resource identifier="file1" type="webcontent">
          <file href="web_resources/ai/tutor/tutorfile.html"/>
        </resource>
        <resource identifier="file2" type="webcontent">
          <file href="regular_folder/file2.html"/>
        </resource>
      </resources>
    </manifest>
    """
    zip_path = tmp_path / "canvas_course.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("course_settings/files_meta.xml", files_meta_xml)
        zf.writestr("imsmanifest.xml", manifest_xml)

    result = parse_files_meta(zip_path)

    # Ensure the file in the tutorbot folder is excluded
    assert len(result["active"]) == 1
    assert result["active"][0]["path"].name == "file2.html"
    assert len(result["unpublished"]) == 1
    assert result["unpublished"][0]["path"].name == "tutorfile.html"
