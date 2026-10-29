"""Delete every mit_edx learning resource and remove the edx platform from search"""

import logging

from django.conf import settings
from django.core.management import BaseCommand, CommandError
from django.db import transaction

from channels.models import Channel
from learning_resources.constants import PlatformType
from learning_resources.etl.constants import ETLSource
from learning_resources.models import (
    ETLSourceOwnership,
    LearningResource,
    LearningResourceRelationship,
    UserListRelationship,
)
from learning_resources.utils import resource_delete_actions, resource_upserted_actions
from learning_resources.views import clear_featured_caches
from learning_resources_search.connection import get_active_aliases, get_conn
from learning_resources_search.constants import (
    COURSE_TYPE,
    HYBRID_COMBINED_INDEX,
    PROGRAM_TYPE,
)
from main.utils import clear_views_cache
from vector_search.constants import (
    CONTENT_FILES_COLLECTION_NAME,
    RESOURCES_COLLECTION_NAME,
)
from vector_search.utils import remove_points_matching_params

log = logging.getLogger(__name__)

MIT_EDX = ETLSource.mit_edx.name
EDX_PLATFORM = PlatformType.edx.name


def remove_edx_platform_from_indexes():
    """
    Remove every edx platform document from OpenSearch and point from Qdrant.
    Only mit_edx resources are on the edx platform, so this also removes what
    the delete hooks miss (their content file tasks look up rows that are
    already gone). Returns the names of the backends that failed.
    """
    failed = []
    query = {
        "query": {
            "nested": {
                "path": "platform",
                "query": {"term": {"platform.code": EDX_PLATFORM}},
            }
        }
    }
    try:
        conn = get_conn()
        # the course and program indexes hold their content files too
        for alias in get_active_aliases(
            conn, object_types=[COURSE_TYPE, PROGRAM_TYPE, HYBRID_COMBINED_INDEX]
        ):
            response = conn.delete_by_query(
                index=alias, body=query, conflicts="proceed", refresh=True
            )
            # a call that returns can still leave documents behind
            if (
                response.get("timed_out")
                or response.get("failures")
                or response.get("version_conflicts")
            ):
                log.error("Partial edx delete from %s: %s", alias, response)
                failed.append(f"OpenSearch ({alias})")
    except Exception:
        log.exception("Could not remove edx documents from OpenSearch")
        failed.append("OpenSearch")
    # embeddings can exist with the indexing hooks off, so check the connection
    if settings.QDRANT_HOST and settings.QDRANT_BASE_COLLECTION_NAME:
        try:
            for collection in (
                RESOURCES_COLLECTION_NAME,
                CONTENT_FILES_COLLECTION_NAME,
            ):
                # wait so a failed delete is reported, not just queued
                remove_points_matching_params(
                    {"platform": EDX_PLATFORM}, collection_name=collection, wait=True
                )
        except Exception:
            log.exception("Could not remove edx points from Qdrant")
            failed.append("Qdrant")
    return failed


def renumber(relationships):
    """Set positions to 1..n, keeping the current order"""
    for position, relationship in enumerate(relationships.order_by("position"), 1):
        if relationship.position != position:
            relationship.position = position
            relationship.save(update_fields=["position"])


class Command(BaseCommand):
    """Delete every mit_edx learning resource"""

    help = "Delete every mit_edx learning resource and remove edx from search"

    def add_arguments(self, parser):
        parser.add_argument(
            "--no-input",
            dest="no_input",
            action="store_true",
            help="Skip the confirmation prompt",
        )

    def handle(self, *args, **options):  # noqa: ARG002
        if not options["no_input"]:
            answer = input(
                "Delete every mit_edx learning resource in "
                f"{settings.ENVIRONMENT}? [y/N]: "
            )
            if answer.strip().lower() not in ("y", "yes"):
                msg = "Aborted."
                raise CommandError(msg)

        resource_ids = list(
            LearningResource.objects.filter(etl_source=MIT_EDX).values_list(
                "id", flat=True
            )
        )
        # collect what the delete touches while the rows still exist
        parent_relations = set(
            LearningResourceRelationship.objects.filter(child_id__in=resource_ids)
            .exclude(parent__etl_source=MIT_EDX)
            .values_list("parent_id", "relation_type")
        )
        parent_ids = {parent_id for parent_id, _ in parent_relations}
        user_list_ids = set(
            UserListRelationship.objects.filter(child_id__in=resource_ids).values_list(
                "parent_id", flat=True
            )
        )
        channels = list(
            Channel.objects.filter(featured_list_id__in=parent_ids).values_list(
                "channel_type", "name"
            )
        )

        ETLSourceOwnership.objects.filter(etl_source=MIT_EDX).delete()
        for resource in LearningResource.objects.filter(id__in=resource_ids):
            # runs the channel and search hooks; each delete commits on its own
            resource_delete_actions(resource)
        self.stdout.write(f"Deleted {len(resource_ids)} mit_edx resources")

        for parent_id, relation_type in parent_relations:
            with transaction.atomic():
                renumber(
                    LearningResourceRelationship.objects.filter(
                        parent_id=parent_id, relation_type=relation_type
                    )
                )
        for user_list_id in user_list_ids:
            with transaction.atomic():
                renumber(UserListRelationship.objects.filter(parent_id=user_list_id))
        self.stdout.write(
            f"Renumbered {len(parent_relations)} parent and "
            f"{len(user_list_ids)} user lists"
        )

        failed = remove_edx_platform_from_indexes()

        parents = LearningResource.objects.filter(id__in=parent_ids, published=True)
        for parent in parents:
            resource_upserted_actions(parent, percolate=False, generate_embeddings=True)
        self.stdout.write(f"Reindexed {len(parents)} parents")

        try:
            clear_views_cache()
        except Exception:
            log.exception("Could not clear the views cache")
            failed.append("views cache")
        if channels:
            # best-effort per page, logs its own Fastly failures
            clear_featured_caches(channels)

        if failed:
            msg = f"Could not clean up: {', '.join(failed)}. Rerun the command."
            raise CommandError(msg)
        self.stdout.write("Removed edx from search and cleared caches")
