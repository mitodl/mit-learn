"""Tests for the healthcheck urls"""

import pytest
from django.urls import get_resolver
from health_check.views import HealthCheckView


@pytest.mark.parametrize(
    "path",
    [
        "/health/",
        "/health/startup/",
        "/health/liveness/",
        "/health/readiness/",
        "/health/full/",
    ],
)
def test_healthcheck_urls_resolve(path):
    """All healthcheck endpoints should resolve to HealthCheckView"""
    # Resolve directly against this urlconf module rather than django.urls.resolve()
    # (which walks the full project urlconf) to avoid pulling in unrelated apps.
    match = get_resolver("main.urls_healthcheck").resolve(path)
    assert match.func.view_class is HealthCheckView
