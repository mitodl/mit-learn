import hashlib
import hmac

from django.conf import settings

from main.constants import (
    ALLOWED_HTML_ATTRIBUTES_WITH_LINKS,
    ALLOWED_HTML_TAGS_WITH_LINKS,
)
from main.utils import clean_data

SIGNATURE_HEADER_NAME = "X-MITLearn-Signature"

# Keys of a resource that hold a list of dicts with a description of their own.
NESTED_DESCRIPTION_KEYS = ("runs",)


def validate_webhook_signature(request):
    """
    Validate the signature of a webhook request.
    Header name and signature must match
    """
    if SIGNATURE_HEADER_NAME not in request.headers:
        return False
    secret = settings.WEBHOOK_SECRET
    signature = request.headers.get(SIGNATURE_HEADER_NAME)
    payload = request.body
    computed_signature = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed_signature, signature)


def _sanitize_description(item):
    """
    Strip disallowed HTML from an item's description in place. A missing,
    null or empty description is left as it is: clean_data would turn null
    into "", and loading "" overwrites a description the sender did not send.
    """
    description = item.get("description")
    if description and isinstance(description, str):
        item["description"] = clean_data(
            description,
            tags=ALLOWED_HTML_TAGS_WITH_LINKS,
            attributes=ALLOWED_HTML_ATTRIBUTES_WITH_LINKS,
        )


def sanitize_learning_resources(resources):
    """
    Sanitize the HTML descriptions of webhook resources, and of the runs
    nested in them, with the allowlist the podcast ETL uses, which keeps
    links. Titles are plain text and are not touched: nh3 would escape
    an ampersand in one.
    """
    for resource in resources:
        _sanitize_description(resource)
        for key in NESTED_DESCRIPTION_KEYS:
            for nested in resource.get(key) or []:
                if isinstance(nested, dict):
                    _sanitize_description(nested)
    return resources
