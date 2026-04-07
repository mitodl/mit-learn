"""Authentication-based decorators"""

import asyncio
from functools import wraps


def blocked_ip_exempt(view_func):
    """Mark a view function as being exempt from blocked IP protection."""

    if asyncio.iscoroutinefunction(view_func):

        async def wrapped_view(*args, **kwargs):
            return await view_func(*args, **kwargs)

    else:

        def wrapped_view(*args, **kwargs):
            return view_func(*args, **kwargs)

    wrapped_view.blocked_ip_exempt = True
    return wraps(view_func)(wrapped_view)
