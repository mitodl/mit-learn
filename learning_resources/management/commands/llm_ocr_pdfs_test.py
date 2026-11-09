"""Tests for the llm_ocr_pdfs management command"""

import pytest
from django.core.management import CommandError, call_command

from learning_resources.constants import LearningResourceType
from learning_resources.etl.constants import ETLSource
from learning_resources.factories import (
    ContentFileFactory,
    LearningResourceFactory,
    LearningResourceRunFactory,
)

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def ocr_settings(settings):
    """Enable OCR"""
    settings.OCR_MODEL = "test/ocr-model"
    return settings


@pytest.fixture
def mock_tasks(mocker):
    """Mock the ETL tasks the command dispatches"""
    return mocker.patch(
        "learning_resources.management.commands.llm_ocr_pdfs.import_content_files"
    ), mocker.patch(
        "learning_resources.management.commands.llm_ocr_pdfs.get_ocw_courses"
    )


def _resource(etl_source, **kwargs):
    """Create a resource of a source with one PDF content file"""
    kwargs.setdefault("resource_type", LearningResourceType.course.name)
    resource = LearningResourceFactory.create(etl_source=etl_source, **kwargs)
    ContentFileFactory.create(
        run=LearningResourceRunFactory.create(learning_resource=resource),
        file_extension=".pdf",
    )
    return resource


def test_llm_ocr_pdfs_dispatches_by_source(mock_tasks, capsys):
    """OLX resources go to import_content_files per source, OCW to get_ocw_courses"""
    mock_import, mock_ocw = mock_tasks
    mitx = [_resource(ETLSource.mitxonline.name) for _ in range(2)]
    xpro = _resource(ETLSource.xpro.name)
    ocw = _resource(
        ETLSource.ocw.name, url="https://ocw.mit.edu/courses/18-01-fall-2020/"
    )

    call_command(
        "llm_ocr_pdfs",
        "--resource-ids",
        f"{mitx[0].id},{mitx[1].id}",
        str(xpro.id),
        str(ocw.id),
    )

    assert sorted(
        (call.args[0], sorted(call.kwargs["learning_resource_ids"]))
        for call in mock_import.si.call_args_list
    ) == sorted(
        [
            (ETLSource.mitxonline.name, sorted(r.id for r in mitx)),
            (ETLSource.xpro.name, [xpro.id]),
        ]
    )
    assert all(call.kwargs["ocr_pdfs"] for call in mock_import.si.call_args_list)
    mock_ocw.si.assert_called_once_with(
        url_paths=["courses/18-01-fall-2020/"],
        force_overwrite=False,
        skip_content_files=False,
        ocr_pdfs=True,
    )
    for signature in [mock_import.si.return_value, mock_ocw.si.return_value]:
        signature.delay.return_value.get.assert_called()
    out = capsys.readouterr().out
    assert f"{xpro.id} {xpro.readable_id} (xpro): 1 PDF(s) currently loaded" in out
    assert "PDF(s) saved during this run" in out


def test_llm_ocr_pdfs_dry_run(mock_tasks, capsys):
    """A dry run lists the resources without dispatching anything"""
    mock_import, _ = mock_tasks
    resource = _resource(ETLSource.mitxonline.name)

    call_command("llm_ocr_pdfs", "--resource-ids", str(resource.id), "--dry-run")

    mock_import.si.return_value.delay.assert_not_called()
    assert f"{resource.id} {resource.readable_id}" in capsys.readouterr().out


@pytest.mark.parametrize(
    ("etl_source", "url", "message"),
    [
        (ETLSource.canvas.name, None, "Canvas PDFs are already OCR'd"),
        (ETLSource.youtube.name, None, "source not supported"),
        (ETLSource.ocw.name, "https://ocw.mit.edu/search/", "source not supported"),
    ],
)
def test_llm_ocr_pdfs_unsupported(mock_tasks, capsys, etl_source, url, message):
    """Resources that can't be re-extracted are reported and skipped"""
    mock_import, mock_ocw = mock_tasks
    resource = _resource(etl_source, url=url)

    call_command("llm_ocr_pdfs", "--resource-ids", str(resource.id))

    mock_import.si.assert_not_called()
    mock_ocw.si.assert_not_called()
    err = capsys.readouterr().err
    assert message in err
    assert "Nothing to process" in err


@pytest.mark.parametrize(
    "resource_type",
    [LearningResourceType.document.name, LearningResourceType.program.name],
)
def test_llm_ocr_pdfs_non_course(mock_tasks, capsys, resource_type):
    """Non-course resources, e.g. OCW learning material PDFs, are skipped"""
    mock_import, mock_ocw = mock_tasks
    resource = _resource(
        ETLSource.ocw.name,
        resource_type=resource_type,
        url="https://ocw.mit.edu/courses/16-01-fall-2005/resources/resource/",
    )

    call_command("llm_ocr_pdfs", "--resource-ids", str(resource.id))

    mock_import.si.assert_not_called()
    mock_ocw.si.assert_not_called()
    err = capsys.readouterr().err
    assert f"{resource_type} resources are not supported, only courses" in err
    assert "Nothing to process" in err


def test_llm_ocr_pdfs_missing_resources(mock_tasks, capsys):
    """Unknown ids are reported"""
    call_command("llm_ocr_pdfs", "--resource-ids", "9999999")

    assert "Learning resources not found: [9999999]" in capsys.readouterr().err


def test_llm_ocr_pdfs_no_model(settings, mock_tasks):
    """The command refuses to run without an OCR model"""
    settings.OCR_MODEL = None
    resource = _resource(ETLSource.xpro.name)

    with pytest.raises(CommandError, match="OCR_MODEL"):
        call_command("llm_ocr_pdfs", "--resource-ids", str(resource.id))
    mock_tasks[0].si.return_value.delay.assert_not_called()


def test_llm_ocr_pdfs_invalid_ids():
    """Non-numeric ids are rejected"""
    with pytest.raises(CommandError, match="Invalid id list"):
        call_command("llm_ocr_pdfs", "--resource-ids", "abc")
