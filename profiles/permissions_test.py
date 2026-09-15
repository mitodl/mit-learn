# pylint: disable=too-many-arguments,redefined-outer-name
"""Tests for profile permissions"""

import pytest
from pytest_lazy_fixtures import lf

from main.factories import UserFactory
from profiles.permissions import HasEditPermission, is_owner_or_privileged_user


@pytest.fixture
def user1():
    """Simple test user fixture"""  # noqa: D401
    return UserFactory.build()


@pytest.fixture
def user2():
    """Another simple test user fixture"""
    return UserFactory.build()


@pytest.mark.parametrize(
    ("object_user", "request_user", "is_super", "is_staff", "exp_result"),
    [
        (lf("user1"), lf("user2"), False, False, False),
        (lf("user1"), lf("user1"), False, False, True),
        (lf("user1"), lf("user2"), True, False, True),
        (lf("user1"), lf("user2"), False, True, True),
    ],
)
def test_is_owner_or_privileged_user(  # noqa: PLR0913
    mocker, object_user, request_user, is_super, is_staff, exp_result
):
    """
    Test that is_owner_or_privileged_user returns True if the object user and request user match, or if the
    request user is a superuser/staff
    """
    request_user.is_superuser = is_super
    request_user.is_staff = is_staff
    request = mocker.Mock(user=request_user)
    assert is_owner_or_privileged_user(object_user, request) is exp_result


def test_can_edit_profile_staff(mocker, staff_user):
    """
    Test that staff users are allowed to view/edit profiles
    """
    request = mocker.Mock(user=staff_user)
    profile = staff_user.profile
    assert HasEditPermission().has_permission(request, mocker.Mock()) is True
    assert (
        HasEditPermission().has_object_permission(request, mocker.Mock(), profile)
        is True
    )


@pytest.mark.parametrize(
    ("method", "result"),
    [("GET", True), ("HEAD", True), ("OPTIONS", True), ("POST", False), ("PUT", False)],
)
@pytest.mark.parametrize("is_super", [True, False])
def test_can_edit_other_profile(mocker, method, result, user, is_super):
    """
    Test that non-staff users are not allowed to edit another user's profile
    """
    request = mocker.Mock(user=user, method=method)
    profile = UserFactory.create(is_superuser=is_super).profile
    assert (
        HasEditPermission().has_object_permission(request, mocker.Mock(), profile)
        is result
        or is_super
    )


@pytest.mark.parametrize("method", ["GET", "HEAD", "OPTIONS", "POST", "PUT"])
def test_can_edit_own_profile(mocker, method, user):
    """
    Test that users are allowed to edit their own profile
    """
    request = mocker.Mock(user=user, method=method)
    profile = user.profile
    assert (
        HasEditPermission().has_object_permission(request, mocker.Mock(), profile)
        is True
    )
