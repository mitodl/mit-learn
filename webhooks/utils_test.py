import hashlib
import hmac

import pytest
from django.test.client import RequestFactory

from webhooks.utils import SIGNATURE_HEADER_NAME, validate_webhook_signature


@pytest.mark.parametrize("body", [b"test payload", b"another payload"])
def test_validate_webhook_signature_valid(mock, body):
    secret = "supersecret"  # noqa: S105
    mock.setattr("django.conf.settings.WEBHOOK_SECRET", secret)
    signature = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    request = RequestFactory().get("/webhooks/content_files")
    request.body = body
    request.headers = {SIGNATURE_HEADER_NAME: signature}
    assert validate_webhook_signature(request) is True


@pytest.mark.parametrize("body", [b"test payload", b"another payload"])
def test_validate_webhook_signature_invalid(mock, body):
    secret = "supersecret"  # noqa: S105
    mock.setattr("django.conf.settings.WEBHOOK_SECRET", secret)
    # Use an incorrect signature
    bad_signature = (
        "bad" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()[3:]
    )

    request = RequestFactory().get("/webhooks/content_files")
    request.body = body
    request.headers = {SIGNATURE_HEADER_NAME: bad_signature}
    assert validate_webhook_signature(request) is False


def test_validate_webhook_signature_missing_header(mock):
    secret = "supersecret"  # noqa: S105
    mock.setattr("django.conf.settings.WEBHOOK_SECRET", secret)
    request = RequestFactory().get("/webhooks/content_files")
    request.body = "test"
    request.headers = {}
    assert validate_webhook_signature(request) is False
