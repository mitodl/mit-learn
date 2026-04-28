from django.conf import settings
from qdrant_client import models

RESOURCES_COLLECTION_NAME = f"{settings.QDRANT_BASE_COLLECTION_NAME}.resources"
CONTENT_FILES_COLLECTION_NAME = f"{settings.QDRANT_BASE_COLLECTION_NAME}.content_files"
TOPICS_COLLECTION_NAME = f"{settings.QDRANT_BASE_COLLECTION_NAME}.topics"


QDRANT_CONTENT_FILE_PARAM_MAP = {
    "key": "key",
    "course_number": "course_number",
    "platform": "platform.code",
    "offered_by": "offered_by.code",
    "file_extension": "file_extension",
    "content_feature_type": "content_feature_type",
    "run_readable_id": "run_readable_id",
    "resource_readable_id": "resource_readable_id",
    "run_title": "run_title",
    "edx_module_id": "edx_module_id",
    "content_type": "content_type",
    "description": "description",
    "title": "title",
    "url": "url",
    "file_type": "file_type",
    "summary": "summary",
    "flashcards": "flashcards",
    "checksum": "checksum",
}

QDRANT_RESOURCE_PARAM_MAP = {
    "readable_id": "readable_id",
    "resource_type": "resource_type",
    "certification": "certification",
    "certification_type": "certification_type.code",
    "professional": "professional",
    "free": "free",
    "course_feature": "course_feature",
    "topic": "topics[].name",
    "ocw_topic": "ocw_topics",
    "level": "runs[].level[].code",
    "department": "departments[].department_id",
    "platform": "platform.code",
    "offered_by": "offered_by.code",
    "delivery": "delivery[].code",
    "title": "title",
    "url": "url",
    "resource_type_group": "resource_type_group",
    "resource_category": "resource_category",
    "published": "published",
    "next_start_date": "next_start_date",
    "views": "views",
    "created_on": "created_on",
}


QDRANT_TOPICS_PARAM_MAP = {
    "name": "name",
}

QDRANT_LEARNING_RESOURCE_INDEXES = {
    "readable_id": models.PayloadSchemaType.KEYWORD,
    "resource_type": models.PayloadSchemaType.KEYWORD,
    "certification": models.PayloadSchemaType.BOOL,
    "certification_type.code": models.PayloadSchemaType.KEYWORD,
    "professional": models.PayloadSchemaType.BOOL,
    "published": models.PayloadSchemaType.BOOL,
    "free": models.PayloadSchemaType.BOOL,
    "course_feature": models.PayloadSchemaType.KEYWORD,
    "topics[].name": models.PayloadSchemaType.KEYWORD,
    "ocw_topics": models.PayloadSchemaType.KEYWORD,
    "runs[].level.code": models.PayloadSchemaType.KEYWORD,
    "departments[].department_id": models.PayloadSchemaType.KEYWORD,
    "platform.code": models.PayloadSchemaType.KEYWORD,
    "offered_by.code": models.PayloadSchemaType.KEYWORD,
    "delivery[].code": models.PayloadSchemaType.KEYWORD,
    "url": models.PayloadSchemaType.KEYWORD,
    "title": models.PayloadSchemaType.KEYWORD,
    "resource_type_group": models.PayloadSchemaType.KEYWORD,
    "resource_category": models.PayloadSchemaType.KEYWORD,
    "next_start_date": models.PayloadSchemaType.DATETIME,
    "created_on": models.PayloadSchemaType.DATETIME,
    "views": models.PayloadSchemaType.INTEGER,
}


QDRANT_LEARNING_RESOURCE_SORTBY_FIELDS = [
    param
    for param in QDRANT_RESOURCE_PARAM_MAP
    if QDRANT_RESOURCE_PARAM_MAP[param] in QDRANT_LEARNING_RESOURCE_INDEXES
    and QDRANT_LEARNING_RESOURCE_INDEXES[QDRANT_RESOURCE_PARAM_MAP[param]]
    in [
        models.PayloadSchemaType.DATETIME,
        models.PayloadSchemaType.INTEGER,
        models.PayloadSchemaType.FLOAT,
        models.PayloadSchemaType.UUID,
    ]
]
"""
Note: Be intentional about which fields we add as indexes.
Only add fields that we expect to filter or facet on frequently.
"""
QDRANT_CONTENT_FILE_INDEXES = {
    "key": models.PayloadSchemaType.KEYWORD,
    "title": models.PayloadSchemaType.KEYWORD,
    "platform.code": models.PayloadSchemaType.KEYWORD,
    "offered_by.code": models.PayloadSchemaType.KEYWORD,
    "file_extension": models.PayloadSchemaType.KEYWORD,
    "run_readable_id": models.PayloadSchemaType.KEYWORD,
    "resource_readable_id": models.PayloadSchemaType.KEYWORD,
    "edx_module_id": models.PayloadSchemaType.KEYWORD,
    "url": models.PayloadSchemaType.KEYWORD,
}


QDRANT_CONTENT_FILES_SORTBY_FIELDS = [
    param
    for param in QDRANT_CONTENT_FILE_PARAM_MAP
    if QDRANT_CONTENT_FILE_PARAM_MAP[param] in QDRANT_CONTENT_FILE_INDEXES
    and QDRANT_CONTENT_FILE_INDEXES[QDRANT_CONTENT_FILE_PARAM_MAP[param]]
    in [
        models.PayloadSchemaType.DATETIME,
        models.PayloadSchemaType.INTEGER,
        models.PayloadSchemaType.FLOAT,
        models.PayloadSchemaType.UUID,
    ]
]

QDRANT_TOPIC_INDEXES = {
    "name": models.PayloadSchemaType.KEYWORD,
}


CONTENT_FILES_RETRIEVE_PAYLOAD = True
RESOURCES_RETRIEVE_PAYLOAD = ["readable_id"]


COLLECTION_PARAM_MAP = {
    RESOURCES_COLLECTION_NAME: QDRANT_RESOURCE_PARAM_MAP,
    TOPICS_COLLECTION_NAME: QDRANT_TOPICS_PARAM_MAP,
    CONTENT_FILES_COLLECTION_NAME: QDRANT_CONTENT_FILE_PARAM_MAP,
}
