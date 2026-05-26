"""Tests for main.decorators"""

import pytest
from celery.exceptions import Reject

from main.decorators import cooldown_task


@pytest.fixture
def mock_redis(mocker):
    """Patch the redis cache used by cooldown_task and return its mock."""
    mock = mocker.Mock()
    mocker.patch("main.decorators.caches", {"redis": mock})
    return mock


def test_cooldown_task_runs_first_call_and_drops_subsequent(mock_redis, mocker):
    """First call runs; subsequent calls within the window are dropped."""
    mock_redis.add.side_effect = [True, False, False]
    inner = mocker.Mock(return_value="result")

    @cooldown_task(wait_time=3600)
    def my_task(*args, **kwargs):
        return inner(*args, **kwargs)

    assert my_task("a", b=1) == "result"
    assert my_task() is None
    assert my_task() is None
    inner.assert_called_once_with("a", b=1)
    for call in mock_redis.add.call_args_list:
        assert call.kwargs["timeout"] == 3600


def test_cooldown_task_uses_custom_key(mock_redis):
    """When `key` is provided, the lock key uses it instead of the func name."""
    mock_redis.add.return_value = True

    @cooldown_task(wait_time=60, key="my-custom-key")
    def my_task():
        return 1

    my_task()
    assert mock_redis.add.call_args[0][0] == "cooldown:my-custom-key"


def test_cooldown_task_default_key_uses_func_name(mock_redis):
    """Default key is derived from the wrapped function's qualified name."""
    mock_redis.add.return_value = True

    @cooldown_task(wait_time=60)
    def some_task():
        return 1

    some_task()
    key = mock_redis.add.call_args[0][0]
    assert key.startswith("cooldown:")
    assert "some_task" in key


def test_cooldown_task_key_func_scopes_per_argument(mock_redis):
    """`key_func` produces a distinct lock per argument set."""
    mock_redis.add.return_value = True

    @cooldown_task(
        wait_time=60,
        key_func=lambda *, sheets_id=None: f"sheet:{sheets_id}",
    )
    def my_task(sheets_id=None):
        return 1

    my_task(sheets_id="A")
    my_task(sheets_id="B")
    keys = [call.args[0] for call in mock_redis.add.call_args_list]
    assert keys[0].endswith(":sheet:A")
    assert keys[1].endswith(":sheet:B")
    assert keys[0] != keys[1]


def test_cooldown_task_lock_held_across_exception(mock_redis):
    """Failures count against the cooldown — lock is not released on exception."""
    mock_redis.add.side_effect = [True, False]

    @cooldown_task(wait_time=60)
    def my_task():
        msg = "boom"
        raise RuntimeError(msg)

    with pytest.raises(RuntimeError):
        my_task()
    assert my_task() is None


def test_cooldown_task_clear_cooldown_deletes_key(mock_redis):
    """`clear_cooldown` deletes the lock key."""

    @cooldown_task(wait_time=60)
    def my_task():
        return 1

    my_task.clear_cooldown()
    assert mock_redis.delete.called
    key = mock_redis.delete.call_args[0][0]
    assert key.startswith("cooldown:")
    assert "my_task" in key


def test_cooldown_task_clear_cooldown_respects_key_func(mock_redis):
    """`clear_cooldown` uses `key_func` so per-argument locks can be cleared."""

    @cooldown_task(
        wait_time=60,
        key_func=lambda *, sheets_id=None: f"sheet:{sheets_id}",
    )
    def my_task(sheets_id=None):
        return 1

    my_task.clear_cooldown(sheets_id="A")
    assert mock_redis.delete.call_args[0][0].endswith(":sheet:A")


def test_cooldown_task_force_bypasses_active_cooldown(mock_redis, mocker):
    """`_cooldown_force=True` runs the wrapped func even when the lock is held."""
    inner = mocker.Mock(return_value="ran")

    @cooldown_task(wait_time=60)
    def my_task(**kwargs):
        return inner(**kwargs)

    result = my_task(_cooldown_force=True)
    assert result == "ran"
    inner.assert_called_once_with()
    mock_redis.add.assert_not_called()
    assert mock_redis.set.called
    assert mock_redis.set.call_args.kwargs["timeout"] == 60


def test_cooldown_task_force_refreshes_cooldown_for_subsequent_calls(mock_redis):
    """After a forced run, an immediate normal call is still gated."""
    mock_redis.add.return_value = False

    @cooldown_task(wait_time=60)
    def my_task(**kwargs):
        return 1

    my_task(_cooldown_force=True)
    assert my_task() is None
    mock_redis.add.assert_called_once()


def test_cooldown_task_raises_reject_inside_celery_worker(mock_redis, mocker):
    """
    When a skip happens inside a real Celery task run, write REJECTED to the
    result backend and raise Reject so the run is observable as REJECTED
    rather than PENDING/SUCCESS.
    """
    mock_redis.add.return_value = False
    mock_task = mocker.patch("main.decorators.current_task")
    mock_task.request.called_directly = False

    @cooldown_task(wait_time=60)
    def my_task():
        return 1

    with pytest.raises(Reject) as exc_info:
        my_task()
    assert exc_info.value.requeue is False
    mock_task.update_state.assert_called_once()
    assert mock_task.update_state.call_args.kwargs["state"] == "REJECTED"
    assert mock_task.update_state.call_args.kwargs["meta"]["reason"] == "cooldown"


def test_cooldown_task_returns_none_when_called_directly(mock_redis, mocker):
    """Direct (non-worker) skipped calls return None — no Reject, no state write."""
    mock_redis.add.return_value = False
    mock_task = mocker.patch("main.decorators.current_task")
    mock_task.request.called_directly = True

    @cooldown_task(wait_time=60)
    def my_task():
        return 1

    assert my_task() is None
    mock_task.update_state.assert_not_called()
