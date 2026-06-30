"""Celery tasks for user-related operations"""

import logging

from django.contrib.auth import get_user_model

from main.celery import app

log = logging.getLogger(__name__)
User = get_user_model()


@app.task
def reindex_user_learning_paths(user_id):
    """
    Re-index OpenSearch documents for learning paths authored by the given user.

    Dispatched asynchronously after a SCIM user update to avoid blocking the
    SCIM PATCH HTTP response with synchronous OpenSearch I/O.  Author metadata
    (name, email) is embedded in learning-path search documents; this task
    ensures those documents stay consistent after a profile change.

    Args:
        user_id (int): Primary key of the updated user.
    """
    from learning_resources.models import LearningPath
    from learning_resources_search.tasks import upsert_learning_resource

    resource_ids = list(
        LearningPath.objects.filter(author_id=user_id).values_list(
            "learning_resource_id", flat=True
        )
    )

    for resource_id in resource_ids:
        upsert_learning_resource.delay(resource_id)

    log.info(
        "Dispatched re-indexing for %d learning path(s) owned by user %d",
        len(resource_ids),
        user_id,
    )
