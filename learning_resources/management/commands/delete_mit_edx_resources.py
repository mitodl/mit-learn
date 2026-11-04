"""Delete every mit_edx learning resource and remove the edx platform from search"""

from django.conf import settings
from django.core.management import BaseCommand, CommandError
from django.db import transaction

from learning_resources.constants import PlatformType
from learning_resources.models import (
    ContentFile,
    ETLSourceOwnership,
    LearningResource,
)
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
from vector_search.utils import qdrant_client, remove_points_matching_params

MIT_EDX = "mit_edx"
EDX = PlatformType.edx.name


def remove_edx_from_opensearch() -> list[str]:
    """Delete every edx platform document. Returns what failed."""
    failed = []
    query = {
        "query": {
            "nested": {"path": "platform", "query": {"term": {"platform.code": EDX}}}
        }
    }
    try:
        conn = get_conn()
        # the course and program indexes hold their content files too
        for alias in get_active_aliases(
            conn, object_types=[COURSE_TYPE, PROGRAM_TYPE, HYBRID_COMBINED_INDEX]
        ):
            # delete_by_query only sees refreshed documents
            conn.indices.refresh(index=alias)
            response = conn.delete_by_query(
                index=alias, body=query, conflicts="proceed", refresh=True
            )
            # a call that returns can still leave documents behind
            if (
                response.get("timed_out")
                or response.get("failures")
                or response.get("version_conflicts")
            ):
                failed.append(f"OpenSearch {alias}: {response}")
    except Exception as err:  # noqa: BLE001
        failed.append(f"OpenSearch: {err!r}")
    return failed


def remove_edx_from_qdrant() -> list[str]:
    """Delete every edx platform point. Returns what failed."""
    # embeddings can exist with the indexing hooks off, so check the connection
    if not (settings.QDRANT_HOST and settings.QDRANT_BASE_COLLECTION_NAME):
        return []
    failed = []
    for collection in (RESOURCES_COLLECTION_NAME, CONTENT_FILES_COLLECTION_NAME):
        try:
            if qdrant_client().collection_exists(collection):
                # wait so a failed delete is reported, not just queued
                remove_points_matching_params(
                    {"platform": EDX}, collection_name=collection, wait=True
                )
        except Exception as err:  # noqa: BLE001
            failed.append(f"Qdrant {collection}: {err!r}")
    return failed


class Command(BaseCommand):
    """Delete every mit_edx learning resource and remove edx from search"""

    help = (
        "Delete every mit_edx learning resource, with its runs and content "
        "files, and remove the edx platform from OpenSearch and Qdrant. Safe to "
        "rerun. Don't run it during recreate_index or an embedding sweep: they "
        "can put edx documents back."
    )

    def handle(self, *args, **options):  # noqa: ARG002
        """Delete the rows, then purge the indexes"""
        ETLSourceOwnership.objects.filter(etl_source=MIT_EDX).delete()

        ids = list(
            LearningResource.objects.filter(etl_source=MIT_EDX).values_list(
                "id", flat=True
            )
        )
        self.stdout.write(f"Deleting {len(ids)} mit_edx resources")
        for count, pk in enumerate(ids, 1):
            # one resource per transaction, so no lock is held for the whole run
            with transaction.atomic():
                # direct_learning_resource is SET_NULL, and a file with no other
                # parent would then fail the ContentFile check constraint
                ContentFile.objects.filter(
                    direct_learning_resource_id=pk,
                    run__isnull=True,
                    learning_resource__isnull=True,
                ).delete()
                LearningResource.objects.filter(pk=pk).delete()
            if count % 50 == 0:
                self.stdout.write(f"Deleted {count}")

        # the purge goes by platform, so other sources there would lose theirs
        others = LearningResource.objects.filter(platform_id=EDX).exclude(
            etl_source=MIT_EDX
        )
        if others.exists():
            failed = [
                (
                    f"edx purge skipped: {others.count()} non-mit_edx resources "
                    "are on the edx platform"
                )
            ]
        else:
            failed = remove_edx_from_opensearch() + remove_edx_from_qdrant()
        clear_views_cache()

        if failed:
            raise CommandError("\n".join(["mit_edx cleanup incomplete:", *failed]))
        self.stdout.write(f"Done: deleted {len(ids)} mit_edx resources")
