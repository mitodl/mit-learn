"""main decorators"""

import inspect
import logging
from collections.abc import Callable
from functools import wraps

from celery import current_task, states
from celery.exceptions import Reject
from django.core.cache import caches

log = logging.getLogger(__name__)

KEY_PREFIX = "cooldown"


def cooldown_task(
    wait_time: int,
    key: str | None = None,
    key_func: Callable[..., str] | None = None,
):
    """
    Drop calls made within `wait_time` seconds of the previous invocation.

    The lock is acquired before the wrapped function runs and is not released
    on exception — failures count against the cooldown to prevent retry
    storms against upstream APIs. Uses an atomic ``cache.add`` so it is safe
    across Celery workers.

    Place this *below* ``@app.task`` so the cooldown runs on the worker, not
    on the enqueuing process.

    When a call is skipped from inside a Celery worker, the task's state is
    explicitly set to ``REJECTED`` in the result backend and
    ``Reject(requeue=False)`` is raised (should be ignored by sentry).

    To bypass the cooldown for a specific invocation (e.g., operator-forced
    recovery), pass ``_cooldown_force=True`` as a kwarg through ``delay()``
    or ``apply_async``. The wrapper consumes it before calling the wrapped
    function and refreshes the lock so subsequent calls are still gated.
    This is race-free relative to clearing the lock from outside, which has
    a window between clear and enqueue where another worker can reacquire.

    The wrapper also exposes ``clear_cooldown(*args, **kwargs)`` which
    deletes the lock key. Useful for operational debugging from a shell;
    prefer ``_cooldown_force=True`` from the enqueuing path.

    Args:
        wait_time: Lock duration in seconds.
        key: Optional static cache key. Defaults to the wrapped function's
            fully-qualified name.
        key_func: Optional callable receiving the wrapped function's bound
            arguments as keyword args; returns a string suffix appended to
            the base key. Opt-in; use to scope the cooldown per
            argument-set.
    """

    def decorator(func):
        base_key = f"{KEY_PREFIX}:{key or f'{func.__module__}.{func.__qualname__}'}"
        sig = inspect.signature(func) if key_func else None

        def _key_for(*args, **kwargs):
            if key_func is None:
                return base_key
            bound = sig.bind(*args, **kwargs)
            bound.apply_defaults()
            return f"{base_key}:{key_func(**bound.arguments)}"

        @wraps(func)
        def wrapper(*args, **kwargs):
            force = kwargs.pop("_cooldown_force", False)
            lock_key = _key_for(*args, **kwargs)
            if force:
                log.info("Force-overriding cooldown for %s", lock_key)
                caches["redis"].set(lock_key, "1", timeout=wait_time)
            elif not caches["redis"].add(lock_key, "1", timeout=wait_time):
                log.info("Skipping %s: cooldown active (%ss)", lock_key, wait_time)
                if current_task and not current_task.request.called_directly:
                    current_task.update_state(
                        state=states.REJECTED,
                        meta={"reason": "cooldown", "key": lock_key},
                    )
                    reason = "cooldown active"
                    raise Reject(reason, requeue=False)
                return None
            return func(*args, **kwargs)

        def clear_cooldown(*args, **kwargs):
            caches["redis"].delete(_key_for(*args, **kwargs))

        wrapper.clear_cooldown = clear_cooldown
        return wrapper

    return decorator
