import hashlib
import hmac

from django.conf import settings


def validate_webhook_signature(request):
    secret = settings.WEBHOOK_SECRET
    signature = request.headers.get("X-Signature")
    payload = request.body
    computed_signature = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed_signature, signature)
