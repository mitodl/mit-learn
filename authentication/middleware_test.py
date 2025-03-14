"""Tests for auth middleware"""

import pytest
from django.shortcuts import reverse

from authentication.middleware import BlockedIPMiddleware
from authentication.models import BlockedIPRange
from main.factories import UserFactory


@pytest.mark.django_db
@pytest.mark.parametrize("is_blocked", [True, False])
@pytest.mark.parametrize("is_super", [True, False])
@pytest.mark.parametrize("exempt_view", [True, False])
@pytest.mark.parametrize("is_routable", [True, False])
def test_process_view_blocked_ip_middleware(  # pylint:disable=too-many-arguments  # noqa: PLR0913
    mocker, rf, is_blocked, is_super, exempt_view, is_routable
):
    """Check that `process_view` raises a PermissionDenied error when appropriate"""
    user = UserFactory.create(is_superuser=is_super)
    view = "lr_search:v1:learning_resources_search"
    request = rf.post(reverse(view))
    request.user = user

    callback = mocker.Mock(blocked_ip_exempt=exempt_view)
    BlockedIPRange.objects.create(ip_start="193.12.12.10", ip_end="193.12.12.12")
    user_ip = "193.12.12.11" if is_blocked else "193.12.12.13"
    mocker.patch(
        "authentication.middleware.get_client_ip", return_value=(user_ip, is_routable)
    )

    middleware = BlockedIPMiddleware(mocker.Mock())
    if is_blocked and is_routable and not exempt_view and not is_super:
        assert middleware.process_view(request, callback, None, {}).status_code == 403
    else:
        assert middleware.process_view(request, callback, None, {}) is None
