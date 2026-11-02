"""Tests for the Celery app's signal handlers"""

import sys

import ol_llm
import pytest
from celery.signals import worker_process_shutdown

from main.celery import LLM_TRACE_FLUSH_TIMEOUT_MILLIS


@pytest.fixture
def mock_flush(mocker):
    """Stand in for ol-llm's trace flush"""
    return mocker.patch.object(ol_llm.tracing, "flush")


def test_worker_process_shutdown_flushes_llm_traces(mocker, mock_flush):
    """A pool child that traced LLM calls sends its traces before it exits"""
    mocker.patch.object(ol_llm.tracing, "enabled", return_value=True)

    worker_process_shutdown.send(sender=None, pid=1, exitcode=0)

    mock_flush.assert_called_once_with(timeout_millis=LLM_TRACE_FLUSH_TIMEOUT_MILLIS)


def test_worker_process_shutdown_skips_flush_when_tracing_off(mocker, mock_flush):
    """Nothing is flushed when tracing is off"""
    mocker.patch.object(ol_llm.tracing, "enabled", return_value=False)

    worker_process_shutdown.send(sender=None, pid=1, exitcode=0)

    mock_flush.assert_not_called()


def test_worker_process_shutdown_does_not_import_ol_llm(monkeypatch, mock_flush):
    """A pool child that never imported ol_llm does not import it to flush"""
    monkeypatch.delitem(sys.modules, "ol_llm")

    worker_process_shutdown.send(sender=None, pid=1, exitcode=0)

    mock_flush.assert_not_called()
    assert "ol_llm" not in sys.modules
