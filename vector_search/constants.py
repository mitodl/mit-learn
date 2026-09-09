from django.conf import settings
from qdrant_client import models

RESOURCES_COLLECTION_NAME = f"{settings.QDRANT_BASE_COLLECTION_NAME}.resources"
CONTENT_FILES_COLLECTION_NAME = f"{settings.QDRANT_BASE_COLLECTION_NAME}.content_files"
TOPICS_COLLECTION_NAME = f"{settings.QDRANT_BASE_COLLECTION_NAME}.topics"

# ContentFile columns (beyond checksum, which only covers content) compared by the
# embed_run_content_files pre-pass to detect stale Qdrant payloads. Every entry MUST
# be an exact serializer pass-through of a scalar/JSON ContentFile column: a field
# the serializer transforms would never converge, flagging every file on every load
# (test_content_file_prepass_fields_are_serializer_pass_through guards this).
CONTENT_FILE_PREPASS_PAYLOAD_FIELDS = (
    "title",
    "description",
    "url",
    "file_type",
    "file_extension",
    "content_type",
    "edx_module_id",
    "summary",
    "flashcards",
)

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

# Payload key holding a resource's completeness score (0-1), the same value the
# OpenSearch script_score penalizes incomplete OCW courses by. Only the resources
# collection carries it; content file payloads do not.
COMPLETENESS_PAYLOAD_KEY = "completeness"

# Payload key holding the date a resource is considered to have aged from -- the
# start date of its last run, or the last modified date for learning materials.
# Null (or absent) means nothing to penalize: resources with an upcoming run are
# never stale. Set by the search serializer, so only the resources collection
# carries it.
RESOURCE_AGE_DATE_PAYLOAD_KEY = "resource_age_date"

# Qdrant decay expressions measure the distance between datetimes in seconds, so
# a staleness horizon in years is converted with this. 365 days, the same year
# length the OpenSearch decay's 365d scale uses.
SECONDS_PER_YEAR = 365 * 24 * 60 * 60

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
    "runs[].level[].code": models.PayloadSchemaType.KEYWORD,
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
    # Not filterable or facetable -- indexed because Qdrant rejects a scoring
    # formula that reads an unindexed payload key (see COMPLETENESS_PAYLOAD_KEY).
    COMPLETENESS_PAYLOAD_KEY: models.PayloadSchemaType.FLOAT,
    # Scoring-only for the same reason: the staleness penalty decays over it, and
    # a datetime index is what makes it readable from a formula.
    RESOURCE_AGE_DATE_PAYLOAD_KEY: models.PayloadSchemaType.DATETIME,
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
RESOURCES_RETRIEVE_PAYLOAD = ["readable_id", "platform"]

# Payload key holding the checksum of the text that produced a resource point's
# vector. The embed gate compares it against the checksum of the context
# rendered now -- see should_generate_resource_embeddings.
RESOURCE_EMBEDDING_CHECKSUM_FIELD = "embedding_checksum"

# Folded into that checksum so that changes to the *format* of the embedding
# context -- a serializer change that renders the same underlying data
# differently, a new section, a reordering -- invalidate every stored checksum.
# Bump it whenever _learning_resource_embedding_context starts producing
# different text for unchanged data.
RESOURCE_EMBEDDING_VERSION = 1

# Payload keys dropped when resource hits are served straight from the Qdrant
# payload (VECTOR_SEARCH_RESOURCES_FROM_PAYLOAD): what the indexing serializer
# adds on top of the LearningResourceSerializer shape the API returns, plus
# video.transcript and podcast_episode.transcript, which the response never
# renders (the podcast episode page fetches its transcript from its own
# endpoint).
#
# content_files is NOT excluded. Document and video responses declare it
# (NestedContentFileSerializer), and search cards fall back to
# content_files[0].image_src for the thumbnail when the resource has no image.
# The indexing serializer re-serializes it with the *full* ContentFileSerializer,
# so its large text fields are trimmed in Python instead -- see
# _trim_indexing_only_list_fields.
#
# This is deliberately not a copy of SOURCE_EXCLUDED_FIELDS: vector_embedding is
# an OpenSearch-only field (grafted on by
# serialize_bulk_learning_resources_with_embeddings), and in Qdrant the dense
# vector lives on the point, not in the payload.
RESOURCES_PAYLOAD_EXCLUDE = [
    "_id",
    "resource_relations",
    "is_learning_material",
    "resource_age_date",
    "featured_rank",
    "is_incomplete_or_stale",
    "video.transcript",
    RESOURCE_EMBEDDING_CHECKSUM_FIELD,
    "podcast_episode.transcript",
]

# Qdrant payload selectors descend into objects but not into lists of objects,
# so the extra fields SearchCourseNumberSerializer puts on each course number
# cannot be named in RESOURCES_PAYLOAD_EXCLUDE and are trimmed in Python.
COURSE_NUMBER_INDEXING_ONLY_FIELDS = frozenset({"sort_coursenum", "primary"})


COLLECTION_PARAM_MAP = {
    RESOURCES_COLLECTION_NAME: QDRANT_RESOURCE_PARAM_MAP,
    TOPICS_COLLECTION_NAME: QDRANT_TOPICS_PARAM_MAP,
    CONTENT_FILES_COLLECTION_NAME: QDRANT_CONTENT_FILE_PARAM_MAP,
}

COLLECTION_INDEX_MAP = {
    RESOURCES_COLLECTION_NAME: QDRANT_LEARNING_RESOURCE_INDEXES,
    TOPICS_COLLECTION_NAME: QDRANT_TOPIC_INDEXES,
    CONTENT_FILES_COLLECTION_NAME: QDRANT_CONTENT_FILE_INDEXES,
}

# Sort keys a point can legitimately have no value for. Qdrant's order_by walks
# the payload index, so a point whose value is null -- or which lacks the key
# altogether -- is left out of the results entirely rather than ordered last:
# next_start_date is null for every learning material, none of which has runs,
# and for every course with no upcoming run, which together are the large
# majority of the collection. Ordering by one of these keys takes the paths that
# put those points last instead of dropping them. Everything else keeps the plain
# order_by: views and created_on are on every resource payload, and their exact
# index ordering is worth more than covering a case that cannot happen.
NULLABLE_ORDER_BY_KEYS = frozenset({"next_start_date"})

# The value a missing datetime is ordered by, which has to fall outside the range
# real dates occupy so those points land at the end of the results either way.
ORDER_BY_MISSING_DATETIME = {
    models.Direction.ASC: "9999-01-01T00:00:00Z",
    models.Direction.DESC: "0001-01-01T00:00:00Z",
}

# Points with no value for the sort key have nothing to order them by, so they
# are ordered by recency instead -- where the tie-broken tail of the equivalent
# OpenSearch sort also ends up. On every resource payload, and indexed.
ORDER_BY_MISSING_TAIL_KEY = "created_on"

# Maximum value of offset + limit accepted by paginated vector search
MAX_RESULT_WINDOW = 1000

# Qdrant Optimizer Settings
# Thresholds for points per shard
QDRANT_OPTIMIZER_THRESHOLD_SMALL = 50_000
QDRANT_OPTIMIZER_THRESHOLD_MEDIUM = 500_000
QDRANT_OPTIMIZER_THRESHOLD_LARGE = 2_000_000

# Target segment sizes
QDRANT_OPTIMIZER_SEGMENT_SMALL = 20_000
QDRANT_OPTIMIZER_SEGMENT_MEDIUM = 60_000
QDRANT_OPTIMIZER_SEGMENT_LARGE = 120_000
QDRANT_OPTIMIZER_SEGMENT_XLARGE = 250_000

# Flush intervals
QDRANT_OPTIMIZER_FLUSH_INTERVAL_SMALL = 15
QDRANT_OPTIMIZER_FLUSH_INTERVAL_MEDIUM = 20
QDRANT_OPTIMIZER_FLUSH_INTERVAL_LARGE = 25
QDRANT_OPTIMIZER_FLUSH_INTERVAL_XLARGE = 30

# Indexing threshold ratio
QDRANT_OPTIMIZER_INDEXING_THRESHOLD_RATIO = 0.8


VECTOR_SEARCH_SCORE_BOOST = {
    RESOURCES_COLLECTION_NAME: [
        {"boost": 0.15, "params": {"resource_type_group": ["program"]}}
    ],
}
