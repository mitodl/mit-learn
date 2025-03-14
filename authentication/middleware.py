"""Authentication middleware"""

from django.db.models import Q
from django.http import HttpResponseForbidden
from django.utils.deprecation import MiddlewareMixin
from ipware import get_client_ip
from rest_framework.permissions import SAFE_METHODS

from authentication.models import BlockedIPRange


class BlockedIPMiddleware(MiddlewareMixin):
    """
    Only allow GET/HEAD requests for blocked ips, unless exempt or a superuser
    """

    def process_view(
        self,
        request,
        callback,
        callback_args,  # noqa: ARG002
        callback_kwargs,  # noqa: ARG002
    ):
        """
        Blocks an individual request if: it is from a blocked ip range, routable, not a safe request
        and not from a superuser (don't want admins accidentally locking themselves out).

        Args:
            request (django.http.request.Request): the request to inspect
        """  # noqa: E501

        if (
            not getattr(callback, "blocked_ip_exempt", False)
            and not request.user.is_superuser
            and not request.path.startswith("/admin/")
        ):
            user_ip, is_routable = get_client_ip(request)

            if user_ip is None or (
                is_routable
                and request.method not in SAFE_METHODS
                and BlockedIPRange.objects.filter(
                    Q(ip_start__lte=user_ip) & Q(ip_end__gte=user_ip)
                ).count()
                > 0
            ):
                return HttpResponseForbidden()
            return None
        return None
