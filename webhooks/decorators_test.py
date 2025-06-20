import pytest
from django.core.exceptions import PermissionDenied
from django.test.client import RequestFactory

from webhooks.decorators import require_signature


def test_require_signature_allows_when_signature_valid(mocker):
    """
    Test that the decorator allows access when the signature is valid.
    """
    mocker.patch("webhooks.decorators.validate_webhook_signature", return_value=True)
    called = {}

    @require_signature
    def view(request, *args, **kwargs):
        called["called"] = True
        return "ok"

    result = view(RequestFactory().post("/webhooks/content_files"))
    assert result == "ok"
    assert called["called"]


def test_require_signature_denies_when_signature_invalid(mocker):
    """
    Test that the decorator raises PermissionDenied when the signature is invalid.
    """
    mocker.patch("webhooks.decorators.validate_webhook_signature", return_value=False)

    @require_signature
    def view(request, *args, **kwargs):
        return "should not get here"

    with pytest.raises(PermissionDenied):
        view(RequestFactory().post("/webhooks/content_files"))
