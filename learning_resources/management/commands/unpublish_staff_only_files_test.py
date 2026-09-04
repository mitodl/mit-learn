"""Tests for the unpublish_staff_only_files management command"""

import pytest
from django.core.management import call_command

pytestmark = pytest.mark.django_db


def test_unpublish_staff_only_files_command(mocker):
    """The command dispatches one fan-out task per requested source"""
    mock_task = mocker.patch(
        "learning_resources.management.commands.unpublish_staff_only_files."
        "unpublish_all_staff_only_files.delay"
    )
    mock_task.return_value.get.return_value = [4, 0]
    call_command(
        "unpublish_staff_only_files",
        "--source",
        "mitxonline",
        "--source",
        "oll",
        "--resource-ids",
        "1,2",
        "--chunk-size",
        "5",
    )
    assert mock_task.call_count == 2
    mock_task.assert_any_call(
        etl_source="mitxonline", chunk_size=5, learning_resource_ids=["1", "2"]
    )
    mock_task.assert_any_call(
        etl_source="oll", chunk_size=5, learning_resource_ids=["1", "2"]
    )
