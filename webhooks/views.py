import json
import logging

from django.core.exceptions import BadRequest
from django.db.transaction import non_atomic_requests
from django.http import HttpResponseBadRequest
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from learning_resources.etl.constants import ETLSource
from learning_resources.models import LearningResource
from learning_resources.tasks import ingest_canvas_course, ingest_edx_course
from learning_resources.utils import (
    resource_delete_actions,
)
from main.utils import clear_views_cache
from video_shorts.api import upsert_video_short
from webhooks.decorators import require_signature
from webhooks.serializers import (
    ContentFileWebHookRequestSerializer,
    VideoShortWebhookRequestSerializer,
    WebhookResponseSerializer,
)

log = logging.getLogger(__name__)


class BaseWebhookView(generics.GenericAPIView):
    @method_decorator(require_POST)
    @method_decorator(require_signature)
    @method_decorator(non_atomic_requests)
    @method_decorator(csrf_exempt)
    def dispatch(self, request, *args, **kwargs):
        return super().dispatch(request, *args, **kwargs)


@extend_schema_view(
    post=extend_schema(
        parameters=[ContentFileWebHookRequestSerializer()],
        responses=WebhookResponseSerializer(),
    ),
)
class ContentFileWebhookView(BaseWebhookView):
    """
    Webhook handler for ContentFile updates
    """

    permission_classes = []
    authentication_classes = []
    serializer_class = ContentFileWebHookRequestSerializer

    def success(self, extra_data=None):
        """
        Return a success response with optional extra data
        """
        if not extra_data:
            extra_data = {}
        response = WebhookResponseSerializer(
            data={"status": "success", "message": "Webhook received", **extra_data}
        )
        if response.is_valid():
            return Response(response.data)
        else:
            log.error("Invalid response data: %s", response.errors)
            return HttpResponseBadRequest("Invalid response data")

    def get_data(self, request):
        """
        Get data from the serializer
        """
        serializer = ContentFileWebHookRequestSerializer(data=json.loads(request.body))
        if not serializer.is_valid():
            log.error("Invalid webhook data: %s", serializer.errors)
            msg = "Invalid data"
            raise BadRequest(msg)
        return serializer.validated_data

    def post(self, request):
        try:
            data = self.get_data(request)
            log.info("Received webhook data: %s", data)
            process_create_content_file_request(data)
            return self.success()
        except json.JSONDecodeError:
            return HttpResponseBadRequest("Invalid JSON format")


@extend_schema_view(
    post=extend_schema(
        parameters=[VideoShortWebhookRequestSerializer()],
        responses=WebhookResponseSerializer(),
    ),
)
class VideoShortWebhookView(BaseWebhookView):
    """
    Webhook handler for VideoShort updates
    """

    permission_classes = []
    authentication_classes = []
    serializer_class = VideoShortWebhookRequestSerializer

    def success(self, extra_data=None):
        """
        Return a success response with optional extra data
        """
        if not extra_data:
            extra_data = {}
        response = WebhookResponseSerializer(
            data={"status": "success", "message": "Webhook received", **extra_data}
        )
        if response.is_valid():
            return Response(response.data)
        else:
            log.error("Invalid response data: %s", response.errors)
            return HttpResponseBadRequest("Invalid response data")

    def get_data(self, request):
        """
        Get data from the serializer
        """
        serializer = VideoShortWebhookRequestSerializer(data=json.loads(request.body))
        serializer.is_valid(raise_exception=True)
        return serializer.validated_data

    def post(self, request):
        try:
            data = self.get_data(request)
            video_data = data.get("video_metadata")
            upsert_video_short(video_data)
            clear_views_cache()
            return self.success()
        except json.JSONDecodeError:
            return HttpResponseBadRequest("Invalid JSON format")
        except ValidationError:
            raise


class ContentFileDeleteWebhookView(ContentFileWebhookView):
    """
    Webhook handler for ContentFile DELETE requests
    """

    def post(self, request):
        try:
            data = self.get_data(request)
            process_delete_content_file_request(data)
            return self.success()
        except json.JSONDecodeError:
            return HttpResponseBadRequest("Invalid JSON format")


def process_create_content_file_request(data):
    """
    Process a content file CREATE webhook request based on the ETL source
    """
    etl_source = data.get("source")
    content_path = data.get("content_path")
    readable_id = data.get("course_readable_id") or data.get("course_id")
    log.info("Processing %s content file: %s", etl_source, content_path)
    if etl_source == ETLSource.canvas.name:
        ingest_canvas_course.apply_async([content_path, False])
    else:
        ingest_edx_course.apply_async(
            [etl_source, content_path],
            kwargs={"course_id": readable_id, "overwrite": False},
        )


def process_delete_content_file_request(data):
    """
    Process a content file DELETE webhhook request based on the ETL source
    """
    etl_source = data.get("source")
    course_id = data.get("course_id")
    course_id_pattern = (
        f"{course_id}-" if etl_source == ETLSource.canvas.name else course_id
    )
    if course_id:
        try:
            resource = LearningResource.objects.get(
                readable_id__istartswith=course_id_pattern,
                etl_source=etl_source,
            )
            resource_delete_actions(resource)
        except LearningResource.DoesNotExist:
            log.warning("Resource with readable_id %s does not exist", course_id)
