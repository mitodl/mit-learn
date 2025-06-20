import hashlib
import hmac
import json

import pytest
from rest_framework.test import APIRequestFactory

from webhooks.utils import SIGNATURE_HEADER_NAME, validate_webhook_signature


@pytest.mark.parametrize(
    "body", [{"test": "test_payload_1"}, {"test": "another payload"}]
)
def test_validate_webhook_signature_valid(settings, body):
    """
    Test that the signature validation passes when the signature matches
    """
    secret = "supersecret"  # noqa: S105
    settings.WEBHOOK_SECRET = secret
    payload = bytes(json.dumps(body), "utf-8")
    signature = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    request = APIRequestFactory().post(
        "/webhooks/content_files",
        data=body,
        content_type="application/json",
        headers={SIGNATURE_HEADER_NAME: signature},
    )

    assert validate_webhook_signature(request) is True


@pytest.mark.parametrize(
    "body", [{"test": "test_payload_1"}, {"test": "another payload"}]
)
def test_validate_webhook_signature_invalid(settings, body):
    """
    Test that the signature validation fails when the signature does not match
    """
    secret = "supoersecret"  # noqa: S105
    settings.WEBHOOK_SECRET = secret
    # Use an incorrect signature
    bad_signature = (
        "bad"
        + hmac.new(
            secret.encode(), json.dumps(body).encode("utf-8"), hashlib.sha256
        ).hexdigest()[3:]
    )

    request = APIRequestFactory().post(
        "/webhooks/content_files",
        data=body,
        content_type="application/json",
        headers={SIGNATURE_HEADER_NAME: bad_signature},
    )

    assert validate_webhook_signature(request) is False


def test_validate_webhook_signature_missing_header(settings):
    """
    Test that the signature validation fails when the signature header is missing
    """

    secret = "supersecret"  # noqa: S105
    settings.WEBHOOK_SECRET = secret
    request = APIRequestFactory().post(
        "/webhooks/content_files", {}, content_type="application/json", headers={}
    )
    assert validate_webhook_signature(request) is False
