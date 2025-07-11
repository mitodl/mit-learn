"""Tests for Canvas ETL functionality"""

import zipfile

import pytest

from learning_resources.constants import LearningResourceType, PlatformType
from learning_resources.etl.canvas import parse_canvas_settings, run_for_canvas_archive
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
    assert resource.platform.code == PlatformType.canvas.name
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
