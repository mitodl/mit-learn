import hashlib
import hmac

from django.conf import settings

SIGNATURE_HEADER_NAME = "X-MITLearn-Signature"


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
