"""Tests of user pipeline actions"""

import pytest

from authentication.pipeline import user as user_actions
from main.factories import UserFactory


@pytest.mark.parametrize("hijacked", [True, False])
def test_forbid_hijack(mocker, hijacked):
    """
    Tests that forbid_hijack action raises an exception if a user is hijacked
    """
    mock_strategy = mocker.Mock()
    mock_strategy.session_get.return_value = hijacked

    mock_backend = mocker.Mock(name="email")

    kwargs = {
        "strategy": mock_strategy,
        "backend": mock_backend,
    }

    if hijacked:
        with pytest.raises(ValueError):  # noqa: PT011
            user_actions.forbid_hijack(**kwargs)
    else:
        assert user_actions.forbid_hijack(**kwargs) == {}


@pytest.mark.django_db
@pytest.mark.parametrize("is_new", [True, False])
def test_user_created_actions(mocker, is_new):
    """
    Tests that user_created_actions creates a favorites list for new users only
    """
    user = UserFactory.create()
    kwargs = {
        "user": user,
        "is_new": is_new,
        "details": {},
    }

    user_actions.user_created_actions(**kwargs)
    assert user.user_lists.count() == (1 if is_new else 0)


@pytest.mark.django_db
@pytest.mark.parametrize("is_new", [True, False])
@pytest.mark.parametrize("skip_onboarding", [True, False])
@pytest.mark.parametrize("next_qs", ["http://example1.com", None])
@pytest.mark.parametrize("social_auth_allowed_redirect_hosts", [["example1.com"], None])
def test_user_onboarding_actions(
    mocker, is_new, skip_onboarding, next_qs, social_auth_allowed_redirect_hosts
):
    """
    Tests that user_created_actions creates a favorites list for new users only
    """

    def setting_side_effect(name, default=None):
        if name == "NEW_USER_LOGIN_REDIRECT_URL":
            return "http://example.com"
        if name == "SOCIAL_AUTH_ALLOWED_REDIRECT_HOSTS":
            return social_auth_allowed_redirect_hosts
        return None

    def session_get_side_effect(name):
        if name == "skip_onboarding":
            return skip_onboarding
        if name == "next":
            return next_qs
        return None

    mock_backend = mocker.Mock(name="email")
    mock_backend.setting.side_effect = setting_side_effect
    mock_backend.strategy.session_get.side_effect = session_get_side_effect
    mock_backend.strategy.request_host = mocker.Mock(return_value="example.com")
    user = UserFactory.create()
    kwargs = {
        "user": user,
        "is_new": is_new,
        "details": {},
        "backend": mock_backend,
    }
    netloc = next_qs.split("/")[2]
    expected_allowed_hosts = (
        [*social_auth_allowed_redirect_hosts, "example.com"]
        if social_auth_allowed_redirect_hosts
        else ["example.com"]
    )
    expected_next = None
    if is_new and not skip_onboarding:
        expected_next = "http://example.com"
    elif next_qs and netloc in expected_allowed_hosts:
        expected_next = next_qs

    user_actions.user_onboarding(**kwargs)
    if expected_next:
        mock_backend.strategy.session_set.assert_called_once_with("next", expected_next)
    else:
        mock_backend.strategy.session_set.assert_not_called()
