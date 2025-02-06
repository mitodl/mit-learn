from django.conf import settings
from django.contrib.auth.models import User
from qdrant_client import models

user = User()
RESOURCES_COLLECTION_NAME = f"{settings.QDRANT_BASE_COLLECTION_NAME}.resources"
CONTENT_FILES_COLLECTION_NAME = f"{settings.QDRANT_BASE_COLLECTION_NAME}.content_files"

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
    "level": "runs[].level.code",
    "department": "departments.department_id",
    "platform": "platform.code",
    "offered_by": "offered_by.code",
    "delivery": "delivery[].code",
    "resource_category": "resource_category",
}


QDRANT_LEARNING_RESOURCE_INDEXES = {
    "readable_id": models.PayloadSchemaType.INTEGER,
    "resource_type": models.PayloadSchemaType.KEYWORD,
    "certification": models.PayloadSchemaType.KEYWORD,
    "certification_type.code": models.PayloadSchemaType.KEYWORD,
    "professional": models.PayloadSchemaType.BOOL,
    "published": models.PayloadSchemaType.BOOL,
    "free": models.PayloadSchemaType.BOOL,
    "course_feature": models.PayloadSchemaType.KEYWORD,
    "topics[].name": models.PayloadSchemaType.KEYWORD,
    "ocw_topics": models.PayloadSchemaType.KEYWORD,
    "runs[].level.code": models.PayloadSchemaType.KEYWORD,
    "departments.department_id": models.PayloadSchemaType.INTEGER,
    "platform.code": models.PayloadSchemaType.KEYWORD,
    "offered_by.code": models.PayloadSchemaType.KEYWORD,
    "delivery[].code": models.PayloadSchemaType.KEYWORD,
    "resource_category": models.PayloadSchemaType.KEYWORD,
}


QDRANT_CONTENT_FILE_INDEXES = {
    "key": models.PayloadSchemaType.KEYWORD,
    "course_number": models.PayloadSchemaType.INTEGER,
    "platform.code": models.PayloadSchemaType.KEYWORD,
    "offered_by.code": models.PayloadSchemaType.KEYWORD,
    "published": models.PayloadSchemaType.BOOL,
    "content_feature_type": models.PayloadSchemaType.KEYWORD,
    "file_extension": models.PayloadSchemaType.KEYWORD,
    "run_readable_id": models.PayloadSchemaType.INTEGER,
    "resource_readable_id": models.PayloadSchemaType.KEYWORD,
    "run_title": models.PayloadSchemaType.KEYWORD,
}
