"""Auth pipline functions for email authentication"""

from social_core.exceptions import AuthException

from authentication.hooks import get_plugin_manager
from profiles import api as profile_api


def forbid_hijack(
    strategy,
    **kwargs,  # noqa: ARG001
):
    """
    Forbid an admin user from trying to login/register while hijacking another user

    Args:
        strategy (social_django.strategy.DjangoStrategy): the strategy used to authenticate
        backend (social_core.backends.base.BaseAuth): the backend being used to authenticate
    """  # noqa: E501
    # As first step in pipeline, stop a hijacking admin from going any further
    if strategy.session_get("is_hijacked_user"):
        msg = "You are hijacking another user, don't try to login again"
        raise AuthException(msg)
    return {}


def user_created_actions(*, user, details, **kwargs):
    """
    Trigger plugins when a user is created
    """
    if kwargs.get("is_new"):
        pm = get_plugin_manager()
        hook = pm.hook
        hook.user_created(user=user, user_data=details)
    else:
        profile_api.ensure_profile(user=user, profile_data=details.get("profile", {}))


def user_onboarding(*, backend, **kwargs):
    """
    Redirect new users to the onboarding flow
    """
    if kwargs.get("is_new"):
        backend.strategy.session_set(
            "next", backend.setting("NEW_USER_LOGIN_REDIRECT_URL")
        )
