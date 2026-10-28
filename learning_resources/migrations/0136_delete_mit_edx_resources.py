import logging

from django.db import migrations, transaction

log = logging.getLogger(__name__)

EDX_PLATFORM = "edx"


def remove_edx_platform_from_indexes():
    """
    Remove every edx platform document from OpenSearch and point from Qdrant.
    Only mit_edx resources are on the edx platform, so this also removes what
    earlier deletes left there (e.g. micromasters programs). It matches on the
    platform rather than on row ids, so it can be rerun from a shell after the
    rows are gone.
    """
    # Runtime imports: the indexes use the current mappings, not migration state
    from django.conf import settings

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

    query = {
        "query": {
            "nested": {
                "path": "platform",
                "query": {"term": {"platform.code": EDX_PLATFORM}},
            }
        }
    }
    # Logged, not raised: a search outage shouldn't fail the deploy
    try:
        conn = get_conn()
        # the course and program indexes hold their content files too
        for alias in get_active_aliases(
            conn, object_types=[COURSE_TYPE, PROGRAM_TYPE, HYBRID_COMBINED_INDEX]
        ):
            conn.delete_by_query(
                index=alias, body=query, conflicts="proceed", refresh=True
            )
    except Exception:
        log.exception("Could not remove edx documents from OpenSearch")
    # embeddings can exist with the indexing hooks off, so check the connection
    if settings.QDRANT_HOST and settings.QDRANT_BASE_COLLECTION_NAME:
        try:
            for collection in (
                RESOURCES_COLLECTION_NAME,
                CONTENT_FILES_COLLECTION_NAME,
            ):
                remove_points_matching_params(
                    {"platform": EDX_PLATFORM}, collection_name=collection
                )
        except Exception:
            log.exception("Could not remove edx points from Qdrant")
    # cached search and resource responses would still list the deleted resources
    try:
        clear_views_cache()
    except Exception:
        log.exception("Could not clear the views cache")


def delete_mit_edx_resources(apps, schema_editor):
    """Delete every mit_edx resource, then clear the edx platform from the indexes"""
    LearningResource = apps.get_model("learning_resources", "LearningResource")
    ETLSourceOwnership = apps.get_model("learning_resources", "ETLSourceOwnership")
    ETLSourceOwnership.objects.filter(etl_source="mit_edx").delete()
    # cascades to runs, content files, relationships and user list entries
    deleted, _ = LearningResource.objects.filter(etl_source="mit_edx").delete()
    if deleted:
        transaction.on_commit(
            remove_edx_platform_from_indexes, using=schema_editor.connection.alias
        )


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources", "0135_learningresource_etl_checksum"),
    ]

    operations = [
        migrations.RunPython(delete_mit_edx_resources, migrations.RunPython.noop),
    ]
