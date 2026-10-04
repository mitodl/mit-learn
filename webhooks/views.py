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
from rest_framework import generics, status
from rest_framework.parsers import JSONParser
from rest_framework.response import Response

from learning_resources.constants import LearningResourceType
from learning_resources.etl.constants import (
    CourseLoaderConfig,
    ETLSource,
    ProgramLoaderConfig,
)
from learning_resources.etl.loaders import (
    load_courses,
    load_documents,
    load_ovs_video_from_webhook,
    load_podcasts,
    load_programs,
    load_videos,
)
from learning_resources.etl.ownership import (
    Pipeline,
    may_write,
    writing_as,
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
from webhooks.utils import sanitize_learning_resources

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
        serializer = OVSVideoWebhookRequestSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if data.get("delete"):
            video_id = data["video_id"]
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
    (etl_source, resource_type) it represents. A pair listed in the optional
    ``sync`` array with no resources in the batch is pruned, unpublishing all
    of it. Resource types without a loader are logged and skipped rather than
    failing the whole batch.
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
        # Descriptions come from third-party feeds by way of the sender, so
        # they are sanitized here rather than trusted to arrive clean.
        grouped = group_learning_resources(
            sanitize_learning_resources(serializer.validated_data["resources"]),
            serializer.validated_data["sync"],
        )
        # Check ownership of every group before loading any, since a partial
        # load would leave the batch half applied with no way for the sender
        # to tell.
        with writing_as(Pipeline.WEBHOOK):
            unowned = unowned_groups(grouped)
            if unowned:
                msg = (
                    f"The webhook does not own {', '.join(unowned)}. Set the "
                    "ETLSourceOwnership rows in Django admin to cut them over."
                )
                log.warning("learning_resources webhook rejected: %s", msg)
                return Response(
                    {"status": "error", "message": msg},
                    status=status.HTTP_409_CONFLICT,
                )
            summary = load_learning_resource_groups(grouped)
        log.info("learning_resources webhook processed: %s", summary)
        clear_views_cache()
        return self.success()


# The resource types each supported group writes. A podcast group carries its
# episodes inline, so the webhook must own both before it may load one.
_WRITTEN_TYPES = {
    LearningResourceType.course.name: [LearningResourceType.course.name],
    LearningResourceType.program.name: [LearningResourceType.program.name],
    LearningResourceType.document.name: [LearningResourceType.document.name],
    LearningResourceType.video.name: [LearningResourceType.video.name],
    LearningResourceType.podcast.name: [
        LearningResourceType.podcast.name,
        LearningResourceType.podcast_episode.name,
    ],
}


def _load_resource_group(etl_source, resource_type, resources):
    """
    Dispatch a group of same-typed resources to the matching loader.

    Returns the list of loaded LearningResource objects, or ``None`` if the
    resource_type has no supported loader (the group is then skipped).
    """
    # Only a sync-declared pair reaches here with no resources, and an empty
    # declared pair is the sender saying nothing of it is published any more.
    prune_empty = not resources
    if resource_type == LearningResourceType.course.name:
        return load_courses(
            etl_source, resources, config=CourseLoaderConfig(prune_empty=prune_empty)
        )
    if resource_type == LearningResourceType.program.name:
        # Child courses arrive as references to courses their own source's
        # course delivery already loaded, so look them up rather than upsert,
        # as the legacy program pipelines do.
        return load_programs(
            etl_source,
            resources,
            config=ProgramLoaderConfig(
                courses=CourseLoaderConfig(fetch_only=True),
                prune=True,
                prune_empty=prune_empty,
            ),
        )
    if resource_type == LearningResourceType.document.name:
        return load_documents(etl_source, resources)
    if resource_type == LearningResourceType.video.name:
        return load_videos(resources)
    if resource_type == LearningResourceType.podcast.name:
        # The batch is the authoritative podcast set, so podcasts absent from
        # it are the ones load_podcasts should stop tracking.
        return load_podcasts(
            resources, [resource["readable_id"] for resource in resources]
        )
    return None


def group_learning_resources(resources, sync):
    """
    Group canonical LearningResource dicts by (etl_source, resource_type),
    adding an empty group for each sync-declared pair with no resources so
    its loader prunes it.
    """
    grouped = defaultdict(list)
    for resource in resources:
        grouped[(resource["etl_source"], resource["resource_type"])].append(resource)
    for pair in sync:
        grouped.setdefault((pair["etl_source"], pair["resource_type"]), [])
    return grouped


def unowned_groups(grouped):
    """
    Return "etl_source/resource_type" for each supported group the current
    pipeline does not own every written type of.
    """
    return [
        f"{etl_source}/{resource_type}"
        for etl_source, resource_type in grouped
        if resource_type in _WRITTEN_TYPES
        and not may_write(etl_source, _WRITTEN_TYPES[resource_type])
    ]


def load_learning_resource_groups(grouped):
    """
    Route each group to its loader and summarize what was loaded or skipped.
    Unsupported resource types are logged and skipped rather than failing the
    whole batch.
    """
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
