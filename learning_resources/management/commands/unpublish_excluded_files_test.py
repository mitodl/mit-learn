"""Tests for the unpublish_excluded_files management command"""

import csv
from io import StringIO
from pathlib import Path

import pytest
from django.core.management import CommandError, call_command

pytestmark = pytest.mark.django_db

COMMAND = "unpublish_excluded_files"
TASK_PATH = (
    "learning_resources.management.commands."
    "unpublish_excluded_files.unpublish_all_excluded_files"
)


@pytest.fixture
def mock_task(mocker):
    """Mock the fan-out task, returning one chunk result per call"""
    task = mocker.patch(TASK_PATH)
    task.delay.return_value.get.return_value = [(2, []), (1, [])]
    return task


def test_unpublish_excluded_files_runs_every_source(mock_task):
    """Without --source the command processes all four edX sources"""
    stdout = StringIO()
    call_command(COMMAND, stdout=stdout)

    sources = [call.kwargs["etl_source"] for call in mock_task.delay.call_args_list]
    assert sources == ["mitxonline", "mit_edx", "xpro", "oll"]
    assert "mitxonline: unpublished 3 content files" in stdout.getvalue()


def test_unpublish_excluded_files_dry_run(mock_task):
    """--dry-run is passed to the task and reported as a would-be change"""
    stdout = StringIO()
    call_command(COMMAND, "--source", "xpro", "--dry-run", stdout=stdout)

    assert mock_task.delay.call_args.kwargs["dry_run"] is True
    assert "xpro: would unpublish 3 content files" in stdout.getvalue()


def test_unpublish_excluded_files_report_requires_resource_ids(mock_task):
    """A report would have to travel back through the result backend unbounded"""
    with pytest.raises(CommandError, match="requires --resource-ids"):
        call_command(COMMAND, "--report", "out.csv", stdout=StringIO())
    mock_task.delay.assert_not_called()


def test_unpublish_excluded_files_writes_report(mock_task, tmp_path):
    """The command process writes the CSV, since the tasks run on other workers"""
    mock_task.delay.return_value.get.return_value = [
        (
            1,
            [
                {
                    "run_id": "course-v1:MITx+1+run",
                    "key": "asset-v1:MITx+1+run+type@asset+block@old.pdf",
                    "source_path": "static/old.pdf",
                    "published": True,
                }
            ],
        )
    ]
    report = tmp_path / "report.csv"
    stdout = StringIO()
    call_command(
        COMMAND,
        "--source",
        "oll",
        "--resource-ids",
        "1,2",
        "--report",
        str(report),
        stdout=stdout,
    )

    assert mock_task.delay.call_args.kwargs["report"] is True
    with Path(report).open() as report_file:
        rows = list(csv.DictReader(report_file))
    assert rows == [
        {
            "etl_source": "oll",
            "run_id": "course-v1:MITx+1+run",
            "key": "asset-v1:MITx+1+run+type@asset+block@old.pdf",
            "source_path": "static/old.pdf",
            "published": "True",
        }
    ]
    assert "Wrote 1 rows" in stdout.getvalue()
