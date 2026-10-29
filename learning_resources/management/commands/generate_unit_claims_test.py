"""Tests for the generate_unit_claims management command"""

import pytest
from django.core.management import CommandError, call_command


def test_generate_unit_claims_requires_target():
    """The command won't sweep every course unless asked to"""
    with pytest.raises(CommandError):
        call_command("generate_unit_claims")


@pytest.mark.parametrize(
    ("args", "expected", "overwrite"),
    [
        (["--resource-id", "3", "--resource-id", "5"], [3, 5], False),
        (["--all"], [7], False),
        (["--all", "--overwrite"], [7], True),
    ],
)
def test_generate_unit_claims(mocker, args, expected, overwrite):
    """The command queues the courses it was given, or every course with units"""
    mocker.patch(
        "learning_resources.management.commands.generate_unit_claims.unit_claims_resource_ids",
        return_value=[7],
    )
    task = mocker.patch(
        "learning_resources.management.commands.generate_unit_claims.generate_all_unit_claims"
    )

    call_command("generate_unit_claims", *args)

    task.delay.assert_called_once_with(expected, overwrite=overwrite)
