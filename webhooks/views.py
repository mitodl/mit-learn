import json
import logging
from collections import defaultdict

from django.core.exceptions import BadRequest
from django.db.transaction import non_atomic_requests
from django.http import HttpResponseBadRequest
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import generics
from rest_framework.parsers import JSONParser
from rest_framework.response import Response

from learning_resources.constants import LearningResourceType
from learning_resources.etl.constants import ETLSource
from learning_resources.etl.loaders import (
    load_courses,
    load_documents,
    load_ovs_video_from_webhook,
    load_podcasts,
    load_programs,
    load_videos,
)
from learning_resources.models import LearningResource
from learning_resources.tasks import ingest_canvas_course, ingest_edx_run_archive
from learning_resources.utils import (
    resource_delete_actions,
)
from main.utils import clear_views_cache
from webhooks.decorators import require_signature
from webhooks.serializers import (
    ContentFileWebHookRequestSerializer,
    LearningResourceWebhookRequestSerializer,
    OVSVideoWebhookRequestSerializer,
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
        request=OVSVideoWebhookRequestSerializer,
        responses=WebhookResponseSerializer(),
    ),
)
class OVSVideoWebhookView(BaseWebhookView):
    """
    Webhook handler for OVS video upserts and deletes from the dagster pipeline
    """

    permission_classes = []
    authentication_classes = []
    parser_classes = [JSONParser]
    serializer_class = OVSVideoWebhookRequestSerializer

    def success(self, extra_data=None):
        if not extra_data:
            extra_data = {}
        response = WebhookResponseSerializer(
            data={"status": "success", "message": "Webhook received", **extra_data}
        )
        if response.is_valid():
            return Response(response.data)
        log.error("Invalid response data: %s", response.errors)
        return HttpResponseBadRequest("Invalid response data")

    def post(self, request):
        try:
            payload = json.loads(request.body)
        except json.JSONDecodeError:
            return HttpResponseBadRequest("Invalid JSON format")
        OVSVideoWebhookRequestSerializer(data=payload).is_valid(raise_exception=True)

        if payload.get("delete"):
            video_id = payload["video_id"]
            resource = LearningResource.objects.filter(
                readable_id=video_id,
                etl_source=ETLSource.ovs.name,
                resource_type=LearningResourceType.video.name,
            ).first()
            if resource:
                resource_delete_actions(resource)
            else:
                log.info("OVS delete webhook: no resource for video_id=%s", video_id)
        else:
            load_ovs_video_from_webhook(payload)

        clear_views_cache()
        return self.success()


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


@extend_schema_view(
    post=extend_schema(
        request=LearningResourceWebhookRequestSerializer,
        responses=WebhookResponseSerializer(),
    ),
)
class LearningResourceWebhookView(BaseWebhookView):
    """
    Generic webhook handler for pre-computed LearningResource batches delivered
    by the OL Data Platform (Dagster).

    The request body is ``{"resources": [ ... ]}`` where each resource is a
    canonical LearningResource dict carrying at minimum ``readable_id``,
    ``etl_source`` and ``resource_type``. Resources are grouped by
    ``(etl_source, resource_type)`` and routed to the matching loader
    (``load_courses`` / ``load_programs`` / ``load_documents`` / ``load_videos``
    / ``load_podcasts``).
    Each loader performs a full sync for that source and upserts the OpenSearch
    index, so a batch must contain the authoritative set of resources for the
    (etl_source, resource_type) it represents. Resource types without a loader
    are logged and skipped rather than failing the whole batch.
    """

    permission_classes = []
    authentication_classes = []
    parser_classes = [JSONParser]
    serializer_class = LearningResourceWebhookRequestSerializer

    def success(self, extra_data=None):
        if not extra_data:
            extra_data = {}
        response = WebhookResponseSerializer(
            data={"status": "success", "message": "Webhook received", **extra_data}
        )
        if response.is_valid():
            return Response(response.data)
        log.error("Invalid response data: %s", response.errors)
        return HttpResponseBadRequest("Invalid response data")

    def post(self, request):
        try:
            payload = json.loads(request.body)
        except json.JSONDecodeError:
            return HttpResponseBadRequest("Invalid JSON format")
        serializer = LearningResourceWebhookRequestSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        summary = process_learning_resources_webhook(
            serializer.validated_data["resources"]
        )
        log.info("learning_resources webhook processed: %s", summary)
        clear_views_cache()
        return self.success()


def _load_resource_group(etl_source, resource_type, resources):
    """
    Dispatch a group of same-typed resources to the matching loader.

    Returns the list of loaded LearningResource objects, or ``None`` if the
    resource_type has no supported loader (the group is then skipped).
    """
    if resource_type == LearningResourceType.course.name:
        return load_courses(etl_source, resources)
    if resource_type == LearningResourceType.program.name:
        return load_programs(etl_source, resources)
    if resource_type == LearningResourceType.document.name:
        return load_documents(etl_source, resources)
    if resource_type == LearningResourceType.video.name:
        return load_videos(resources)
    if resource_type == LearningResourceType.podcast.name:
        return load_podcasts(resources)
    return None


def process_learning_resources_webhook(resources):
    """
    Group canonical LearningResource dicts by (etl_source, resource_type) and
    route each group to the appropriate loader. Unsupported resource types are
    logged and skipped rather than failing the whole batch.
    """
    grouped = defaultdict(list)
    for resource in resources:
        grouped[(resource["etl_source"], resource["resource_type"])].append(resource)

    summary = {"loaded": 0, "skipped": 0, "groups": []}
    for (etl_source, resource_type), items in grouped.items():
        loaded = _load_resource_group(etl_source, resource_type, items)
        if loaded is None:
            log.warning(
                "No loader for resource_type=%s (etl_source=%s); skipping %d "
                "resource(s)",
                resource_type,
                etl_source,
                len(items),
            )
            summary["skipped"] += len(items)
            status = "skipped"
            loaded_count = 0
        else:
            loaded_count = len(loaded)
            summary["loaded"] += loaded_count
            status = "loaded"
        summary["groups"].append(
            {
                "etl_source": etl_source,
                "resource_type": resource_type,
                "received": len(items),
                "loaded": loaded_count,
                "status": status,
            }
        )
    return summary


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
        ingest_edx_run_archive.apply_async(
            [etl_source, content_path],
            kwargs={"run_id": readable_id, "overwrite": False},
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
