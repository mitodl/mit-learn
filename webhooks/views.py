import json
import logging

from django.db.transaction import non_atomic_requests
from django.http import HttpResponseBadRequest, JsonResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import views

from learning_resources.etl.constants import ETLSource
from learning_resources.tasks import ingest_canvas_course
from webhooks.decorators import require_signature
from webhooks.serializers import ContentFileWebHookRequestSerializer

log = logging.getLogger(__name__)


class BaseWebhookView(views.APIView):
    @method_decorator(require_POST)
    @method_decorator(require_signature)
    @method_decorator(non_atomic_requests)
    @method_decorator(csrf_exempt)
    def dispatch(self, request):
        return super().dispatch(request)


@extend_schema_view(
    post=extend_schema(
        parameters=[ContentFileWebHookRequestSerializer()],
    ),
)
class ContentFileWebhookView(BaseWebhookView):
    """
    Webhook handler for ContentFile updates
    """

    def post(self, request):
        """
        Handle POST requests to the webhook.
        """
        try:
            serializer = ContentFileWebHookRequestSerializer(
                data=json.loads(request.body)
            )
            if not serializer.is_valid():
                log.error("Invalid webhook data: %s", serializer.errors)
                return HttpResponseBadRequest("Invalid data")
            data = serializer.validated_data
            log.info("Received webhook data: %s", data)
            process_content_file_request(data)
            return JsonResponse({"status": "success", "message": "Webhook received"})
        except json.JSONDecodeError:
            return HttpResponseBadRequest("Invalid JSON format")


def process_content_file_request(data):
    """
    Process a content file webhhok request based on the ETL source
    """
    etl_source = data.get("source")
    url = data.get("content_url")
    if etl_source == ETLSource.canvas.name:
        log.info("Processing Canvas content file: %s", url)
        ingest_canvas_course.apply_async([url, True])
