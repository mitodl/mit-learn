"""Tests for Canvas ETL functionality"""

import zipfile

import pytest

from learning_resources.constants import LearningResourceType, PlatformType
from learning_resources.etl.canvas import (
    parse_canvas_settings,
    parse_module_meta,
    run_for_canvas_archive,
)
from learning_resources.etl.constants import ETLSource
from learning_resources.factories import (
    LearningResourceFactory,
    LearningResourcePlatformFactory,
)
from learning_resources.models import LearningResource

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def canvas_platform():
    """Fixture for the canvas platform"""
    return LearningResourcePlatformFactory.create(code=PlatformType.canvas.name)


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
    mocker.patch("learning_resources.etl.canvas.calc_checksum", return_value="abc123")
    # No resource exists yet
    course_archive_path = tmp_path / "archive.zip"
    course_archive_path.write_text("dummy")
    _, run = run_for_canvas_archive(
        course_archive_path, course_folder=course_folder, overwrite=True
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
