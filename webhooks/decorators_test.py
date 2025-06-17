import pytest
from django.core.exceptions import PermissionDenied
from django.test.client import RequestFactory

from webhooks.decorators import require_signature


def test_require_signature_allows_when_signature_valid(monkeypatch, dummy_request):
    monkeypatch.setattr("webhooks.utils.validate_webhook_signature", lambda: True)

    called = {}

    @require_signature
    def view(request, *args, **kwargs):
        called["called"] = True
        return "ok"

    result = view(RequestFactory().get("/webhooks/content_files"))
    assert result == "ok"
    assert called["called"]


def test_require_signature_denies_when_signature_invalid(monkeypatch, dummy_request):
    monkeypatch.setattr("webhooks.utils.validate_webhook_signature", lambda: False)

    @require_signature
    def view(request, *args, **kwargs):
        return "should not get here"

    with pytest.raises(PermissionDenied):
        view(RequestFactory().get("/webhooks/content_files"))
