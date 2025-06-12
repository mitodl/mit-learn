import json
import logging

from django.db.transaction import non_atomic_requests
from django.http import HttpResponseBadRequest, JsonResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.views.generic import View

from webhooks.decorators import require_signature

log = logging.getLogger(__name__)


class BaseWebhookView(View):
    @method_decorator(require_POST)
    @method_decorator(require_signature)
    @method_decorator(non_atomic_requests)
    @method_decorator(csrf_exempt)
    def dispatch(self, request):
        return super().dispatch(request)


class ContentFileWebhookView(BaseWebhookView):
    """
    Webhook handler for ContentFile updates
    """

    def post(self, request):
        """
        Handle POST requests to the webhook.
        """
        try:
            data = json.loads(request.body)
            log.info("Received webhook data: %s", data)
            return JsonResponse({"status": "success", "message": "Webhook received"})
        except json.JSONDecodeError:
            return HttpResponseBadRequest("Invalid JSON format")
