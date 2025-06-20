from functools import wraps

from asgiref.sync import iscoroutinefunction
from django.core.exceptions import PermissionDenied

from webhooks.utils import validate_webhook_signature


def require_signature(view_func):
    """
    Ensure that the view function is only called if the request
    has a valid webhook signature.
    Raises PermissionDenied if the signature is invalid.
    """

    def _check_request(request):
        if not validate_webhook_signature(request):
            raise PermissionDenied

    if iscoroutinefunction(view_func):

        async def _view_wrapper(request, *args, **kwargs):
            _check_request(request)
            return await view_func(request, *args, **kwargs)

    else:

        def _view_wrapper(request, *args, **kwargs):
            _check_request(request)
            return view_func(request, *args, **kwargs)

    return wraps(view_func)(_view_wrapper)
