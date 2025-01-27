"""API for general search-related functionality"""

import logging
import re
from collections import Counter
from datetime import UTC, datetime

from django.conf import settings
from opensearch_dsl import Search
from opensearch_dsl.query import MoreLikeThis, Percolate
from opensearchpy.exceptions import NotFoundError

from learning_resources.models import LearningResource
from learning_resources_search.connection import (
    get_default_alias_name,
)
from learning_resources_search.constants import (
    CONTENT_FILE_TYPE,
    COURSE_QUERY_FIELDS,
    COURSE_TYPE,
    DEPARTMENT_QUERY_FIELDS,
    LEARNING_RESOURCE,
    LEARNING_RESOURCE_QUERY_FIELDS,
    LEARNING_RESOURCE_SEARCH_SORTBY_OPTIONS,
    LEARNING_RESOURCE_TYPES,
    RESOURCEFILE_QUERY_FIELDS,
    RUN_INSTRUCTORS_QUERY_FIELDS,
    RUNS_QUERY_FIELDS,
    SEARCH_FILTERS,
    SOURCE_EXCLUDED_FIELDS,
    TOPICS_QUERY_FIELDS,
)
from learning_resources_search.models import PercolateQuery
from learning_resources_search.utils import (
    adjust_search_for_percolator,
    document_percolated_actions,
)
from vector_search.constants import RESOURCES_COLLECTION_NAME

log = logging.getLogger(__name__)

LEARN_SUGGEST_FIELDS = ["title.trigram", "description.trigram"]
COURSENUM_SORT_FIELD = "course.course_numbers.sort_coursenum"
DEFAULT_SORT = [
    "featured_rank",
    "is_learning_material",
    "is_incomplete_or_stale",
    "-created_on",
]


def gen_content_file_id(content_file_id):
    """
    Generate the OpenSearch document id for a ContentFile

    Args:
        id (int): The id of a ContentFile object

    Returns:
        str: The OpenSearch document id for this object
    """
    return f"cf_{content_file_id}"


def relevant_indexes(resource_types, aggregations, endpoint):
    """
    Return list of relevent index type for the query

    Args:
        resource_types (list): the resource type parameter for the search
        aggregations (list): the aggregations parameter for the search
        endpoint (string): the endpoint: learning_resource or content_file

    Returns:
        Array(string): array of index names

    """
    if endpoint == CONTENT_FILE_TYPE:
        return [get_default_alias_name(COURSE_TYPE)]

    if aggregations and "resource_type" in aggregations:
        return map(get_default_alias_name, LEARNING_RESOURCE_TYPES)

    return map(get_default_alias_name, set(resource_types))


def generate_sort_clause(search_params):
    """
    Return sort clause for the query

    Args:
        sort (dict): the search params
    Returns:
        dict or String: either a dictionary with the sort clause for
            nested sort params or just sort parameter
    """

    sort = (
        LEARNING_RESOURCE_SEARCH_SORTBY_OPTIONS.get(search_params.get("sortby"), {})
        .get("sort")
        .replace("0__", "")
        .replace("__", ".")
    )

    departments = search_params.get("department")

    if "." in sort:
        if sort.startswith("-"):
            field = sort[1:]
            direction = "desc"
        else:
            field = sort
            direction = "asc"

        path = ".".join(field.split(".")[:-1])

        sort_filter = {}
        if field == COURSENUM_SORT_FIELD:
            if departments:
                sort_filter = {
                    "filter": {
                        "bool": {
                            "should": [
                                {
                                    "term": {
                                        f"{path}.department.department_id": department
                                    }
                                }
                                for department in departments
                            ]
                        }
                    }
                }
            else:
                sort_filter = {"filter": {"term": {f"{path}.primary": True}}}
        return {field: {"order": direction, "nested": {"path": path, **sort_filter}}}

    else:
        return sort


def wrap_text_clause(text_query, min_score=None):
    """
    Wrap the text subqueries in a bool query
    Shared by generate_content_file_text_clause and
    generate_learning_resources_text_clause

    Args:
        text_query (dict): dictionary with the opensearch text clauses
    Returns:
        dict: dictionary with the opensearch text clause
    """
    if min_score and text_query:
        text_bool_clause = [
            {"function_score": {"query": {"bool": text_query}, "min_score": min_score}}
        ]

    else:
        text_bool_clause = [{"bool": text_query}] if text_query else []

    return {
        "bool": {
            "filter": {
                "bool": {"must": text_bool_clause},
            },
            # Add multimatch text query here again to score results based on match
            **text_query,
        }
    }


def generate_content_file_text_clause(text):
    """
    Return text clause for the query

    Args:
        text (string): the text string
    Returns:
        dict: dictionary with the opensearch text clause
    """

    query_type = (
        "query_string" if text.startswith('"') and text.endswith('"') else "multi_match"
    )

    if text:
        text_query = {
            "should": [
                {query_type: {"query": text, "fields": RESOURCEFILE_QUERY_FIELDS}},
                {
                    "nested": {
                        "path": "departments",
                        "query": {
                            query_type: {
                                "query": text,
                                "fields": DEPARTMENT_QUERY_FIELDS,
                            }
                        },
                    }
                },
            ]
        }
    else:
        text_query = {}

    return wrap_text_clause(text_query)


def generate_learning_resources_text_clause(
    text, search_mode, slop, content_file_score_weight, min_score
):
    """
    Return text clause for the query

    Args:
        text (string): the text string
    Returns:
        dict: dictionary with the opensearch text clause
    """

    query_type = (
        "query_string" if text.startswith('"') and text.endswith('"') else "multi_match"
    )

    extra_params = {}

    if query_type == "multi_match" and search_mode:
        extra_params["type"] = search_mode

        if search_mode == "phrase" and slop:
            extra_params["slop"] = slop

    if content_file_score_weight is not None:
        resourcefile_fields = [
            f"{field}^{content_file_score_weight}"
            for field in RESOURCEFILE_QUERY_FIELDS
        ]
    else:
        resourcefile_fields = RESOURCEFILE_QUERY_FIELDS

    if text:
        text_query = {
            "should": [
                {
                    query_type: {
                        "query": text,
                        "fields": LEARNING_RESOURCE_QUERY_FIELDS,
                        **extra_params,
                    }
                },
                {
                    "nested": {
                        "path": "topics",
                        "query": {
                            query_type: {
                                "query": text,
                                "fields": TOPICS_QUERY_FIELDS,
                                **extra_params,
                            }
                        },
                    }
                },
                {
                    "nested": {
                        "path": "departments",
                        "query": {
                            query_type: {
                                "query": text,
                                "fields": DEPARTMENT_QUERY_FIELDS,
                                **extra_params,
                            }
                        },
                    }
                },
                {
                    "nested": {
                        "path": "course.course_numbers",
                        "query": {
                            query_type: {
                                "query": text,
                                "fields": COURSE_QUERY_FIELDS,
                                **extra_params,
                            }
                        },
                    }
                },
                {
                    "nested": {
                        "path": "runs",
                        "query": {
                            query_type: {
                                "query": text,
                                "fields": RUNS_QUERY_FIELDS,
                                **extra_params,
                            }
                        },
                    }
                },
                {
                    "nested": {
                        "path": "runs",
                        "query": {
                            "nested": {
                                "path": "runs.instructors",
                                "query": {
                                    query_type: {
                                        "query": text,
                                        "fields": RUN_INSTRUCTORS_QUERY_FIELDS,
                                        "type": "best_fields",
                                    }
                                },
                            }
                        },
                    }
                },
                {
                    "has_child": {
                        "type": "content_file",
                        "query": {
                            query_type: {
                                "query": text,
                                "fields": resourcefile_fields,
                                **extra_params,
                            }
                        },
                        "score_mode": "avg",
                    }
                },
            ]
        }
    else:
        text_query = {}

    return wrap_text_clause(text_query, min_score)


def generate_filter_clause(
    path: str, value: str, *, case_sensitive: bool, _current_path_length=1
):
    """
    Generate search clause for a single filter path abd value.

    Args:
        path (str): Search index on which to filter
        value (str): Value of filter
        case_sensitive(bool): Whether to match value case-sensitively or not

    Returns:
        An OpenSearch query clause for use in filtering.

    NOTE: Paths with periods are assumed to be nested. E.g., path='a.b.c' will
    generate a doubly-nested query clause.
    """
    path_pieces = path.split(".")
    current_path = ".".join(path_pieces[0:_current_path_length])
    if current_path == path:
        case_sensitivity = {} if case_sensitive else {"case_insensitive": True}
        return {"term": {path: {"value": value, **case_sensitivity}}}

    return {
        "nested": {
            "path": current_path,
            "query": generate_filter_clause(
                path,
                value,
                case_sensitive=case_sensitive,
                _current_path_length=_current_path_length + 1,
            ),
        }
    }


def generate_filter_clauses(search_params):
    """
    Return the filter clauses for the query

    Args:
        search_params (dict): the query parameters for the search
    Returns:
        dict: dictionary with the opensearch filter clauses. Because the filters are
        used to generate aggregations, this function returns a dictionary with each of
        the active filters as the keys and the opensearch filter clause for that
        filter as the query
    """
    all_filter_clauses = {}

    for filter_name, filter_config in SEARCH_FILTERS.items():
        if search_params.get(filter_name):
            clauses_for_filter = [
                generate_filter_clause(
                    filter_config.path,
                    filter_value,
                    case_sensitive=filter_config.case_sensitive,
                )
                for filter_value in search_params.get(filter_name)
            ]

            all_filter_clauses[filter_name] = {"bool": {"should": clauses_for_filter}}

    return all_filter_clauses


def generate_suggest_clause(text):
    """
    Return the suggest clause for the query

    Args:
        text (string): the text string
    Returns:
        dict: dictionary with the opensearch suggest clause
    """

    suggest = {"text": text}

    for field in LEARN_SUGGEST_FIELDS:
        suggest[field] = {
            "phrase": {
                "field": field,
                "size": 5,
                "gram_size": 1,
                "confidence": 0.0001,
                "max_errors": 3,
                "collate": {
                    "query": {
                        "source": {"match_phrase": {"{{field_name}}": "{{suggestion}}"}}
                    },
                    "params": {"field_name": field},
                    "prune": True,
                },
            }
        }

    return suggest


def generate_aggregation_clause(
    aggregation_name: str, path: str, _current_path_length=1
):
    """
    Generate a search aggregation clause for a search query.

    Args:
        aggregation_name (str): name of aggregation
        path (str): Search index on which to aggregate

    Returns:
        An OpenSearch query clause for use in aggregation.

    NOTE: Properties with periods are assumed to be nested. E.g., path='a.b.c'
    will generate a doubly-nested query clause.
    """
    path_pieces = path.split(".")
    current_path = ".".join(path_pieces[0:_current_path_length])

    if current_path == path:
        bucket_agg = {"terms": {"field": path, "size": 10000}}
        if _current_path_length == 1:
            return bucket_agg
        else:
            # In case of nested aggregations, use reverse_nested to return the
            # root document count to avoid overcounting. For example, a resource
            # with 5 runs all with level high_school would otherwise count 5
            # times toward a level aggregation.
            #
            # Strictly speaking, this is only necessary for fields that may
            # contain arrays with duplicated field values.
            return {**bucket_agg, "aggs": {"root": {"reverse_nested": {}}}}

    return {
        "nested": {"path": current_path},
        "aggs": {
            aggregation_name: generate_aggregation_clause(
                aggregation_name, path, _current_path_length + 1
            )
        },
    }


def generate_aggregation_clauses(search_params, filter_clauses):
    """
    Return the aggregations for the query

    Args:
        search_params (dict): the query parameters for the search
        filter_clauses(dict): the filter clauses generated by generate_filter_clauses
    Returns:
        dict: dictionary with the opensearch aggregation clause
    """
    aggregation_clauses = {}
    if search_params.get("aggregations"):
        for aggregation in search_params.get("aggregations"):
            # Each aggregation clause contains a filter which includes all the filters
            # except it's own
            path = SEARCH_FILTERS[aggregation].path
            unfiltered_aggs = generate_aggregation_clause(aggregation, path)
            other_filters = [
                filter_clauses[key] for key in filter_clauses if key != aggregation
            ]

            if other_filters:
                aggregation_clauses[aggregation] = {
                    "aggs": {aggregation: unfiltered_aggs},
                    "filter": {"bool": {"must": other_filters}},
                }
            else:
                aggregation_clauses[aggregation] = unfiltered_aggs

    return aggregation_clauses


def order_params(params):
    """
    Order params dict by keys and sorts all contained lists.
    """
    if isinstance(params, dict):
        return {k: order_params(v) for k, v in sorted(params.items())}
    elif isinstance(params, list):
        return sorted(order_params(item) for item in params)
    else:
        return params


def adjust_query_for_percolator(query_params):
    search = construct_search(query_params.copy())
    return adjust_search_for_percolator(search).to_dict()["query"]


def adjust_original_query_for_percolate(query):
    """
    Remove keys that are irrelevent when storing original queries
    for percolate uniqueness such as "limit" and "offset"
    """
    for key in [
        "limit",
        "offset",
        "sortby",
        "yearly_decay_percent",
        "dev_mode",
        "use_dfs_query_then_fetch",
        "max_incompleteness_penalty",
        "min_score",
        "search_mode",
        "slop",
        "use_dfs_query_then_fetch",
    ]:
        query.pop(key, None)
    return order_params(query)


def percolate_matches_for_document(document_id):
    """
    Percolate matching queries for a given learning resource
    and call signal handler with matches
    """
    resource = LearningResource.objects.get(id=document_id)
    index = get_default_alias_name(resource.resource_type)
    search = Search()
    percolate_ids = []
    try:
        results = search.query(
            Percolate(field="query", index=index, id=str(document_id))
        ).execute()
        percolate_ids = [result.id for result in results.hits]
    except NotFoundError:
        log.info("document %s not found in index", document_id)
    percolated_queries = PercolateQuery.objects.filter(id__in=percolate_ids)
    if len(percolate_ids) > 0:
        document_percolated_actions(resource, percolated_queries)
    return percolated_queries


def add_text_query_to_search(search, text, search_params, query_type_query):
    if search_params.get("endpoint") == CONTENT_FILE_TYPE:
        text_query = generate_content_file_text_clause(text)
    else:
        text_query = generate_learning_resources_text_clause(
            text,
            search_params.get("search_mode"),
            search_params.get("slop"),
            search_params.get("content_file_score_weight"),
            search_params.get("min_score"),
        )

    yearly_decay_percent = search_params.get("yearly_decay_percent")
    max_incompleteness_penalty = (
        search_params.get("max_incompleteness_penalty", 0) / 100
    )

    if yearly_decay_percent or max_incompleteness_penalty:
        script_query = {
            "script_score": {
                "query": {"bool": {"must": [text_query], "filter": query_type_query}}
            }
        }

        completeness_term = (
            "(doc['completeness'].value * params.max_incompleteness_penalty + "
            "(1-params.max_incompleteness_penalty))"
        )

        staleness_term = (
            "(doc['resource_age_date'].size() == 0 ? 1 : "
            "decayDateLinear(params.origin, params.scale, params.offset, params.decay, "
            "doc['resource_age_date'].value))"
        )

        source = "_score"
        params = {}

        if max_incompleteness_penalty:
            source = f"{source} * {completeness_term}"
            params["max_incompleteness_penalty"] = max_incompleteness_penalty

        if yearly_decay_percent:
            source = f"{source} * {staleness_term}"
            params["decay"] = 1 - (yearly_decay_percent / 100)
            params["offset"] = "0"
            params["scale"] = "365d"
            params["origin"] = datetime.now(tz=UTC).strftime("%Y-%m-%dT%H:%M:%S.%fZ")

        script_query["script_score"]["script"] = {
            "source": source,
            "params": params,
        }

        search = search.query(script_query)
    else:
        search = search.query("bool", must=[text_query], filter=query_type_query)

    return search


def construct_search(search_params):
    """
    Construct a learning resources search based on the query


    Args:
        search_params (dict): The opensearch query params returned from
        LearningResourcesSearchRequestSerializer

    Returns:
        opensearch_dsl.Search: an opensearch search instance
    """

    if (
        not search_params.get("resource_type")
        and search_params.get("endpoint") != CONTENT_FILE_TYPE
    ):
        search_params["resource_type"] = list(LEARNING_RESOURCE_TYPES)

    indexes = relevant_indexes(
        search_params.get("resource_type"),
        search_params.get("aggregations"),
        search_params.get("endpoint"),
    )

    search = Search(index=",".join(indexes))

    search = search.source(fields={"excludes": SOURCE_EXCLUDED_FIELDS})
    search = search.params(search_type="dfs_query_then_fetch")
    if search_params.get("offset"):
        search = search.extra(from_=search_params.get("offset"))

    if search_params.get("limit"):
        search = search.extra(size=search_params.get("limit"))

    if search_params.get("sortby"):
        sort = generate_sort_clause(search_params)
        search = search.sort(sort)
    elif not search_params.get("q"):
        search = search.sort(*DEFAULT_SORT)

    if search_params.get("endpoint") == CONTENT_FILE_TYPE:
        query_type_query = {"exists": {"field": "content_type"}}
    else:
        query_type_query = {"exists": {"field": "resource_type"}}

    if search_params.get("q"):
        text = re.sub("[\u201c\u201d]", '"', search_params.get("q"))

        search = add_text_query_to_search(
            search,
            text,
            search_params,
            query_type_query,
        )

        suggest = generate_suggest_clause(text)
        search = search.extra(suggest=suggest)
    else:
        search = search.query(query_type_query)

    filter_clauses = generate_filter_clauses(search_params)

    search = search.post_filter("bool", must=list(filter_clauses.values()))

    if search_params.get("aggregations"):
        aggregation_clauses = generate_aggregation_clauses(
            search_params, filter_clauses
        )
        search = search.extra(aggs=aggregation_clauses)

    if search_params.get("dev_mode"):
        search = search.extra(explain=True)

    return search


def execute_learn_search(search_params):
    """
    Execute a learning resources search based on the query


    Args:
        search_params (dict): The opensearch query params returned from
        LearningResourcesSearchRequestSerializer

    Returns:
        dict: The opensearch response dict
    """
    if search_params.get("endpoint") != CONTENT_FILE_TYPE:
        if search_params.get("yearly_decay_percent") is None:
            search_params["yearly_decay_percent"] = (
                settings.DEFAULT_SEARCH_STALENESS_PENALTY
            )
        if search_params.get("search_mode") is None:
            search_params["search_mode"] = settings.DEFAULT_SEARCH_MODE
        if search_params.get("slop") is None:
            search_params["slop"] = settings.DEFAULT_SEARCH_SLOP
        if search_params.get("min_score") is None:
            search_params["min_score"] = settings.DEFAULT_SEARCH_MINIMUM_SCORE_CUTOFF
        if search_params.get("max_incompleteness_penalty") is None:
            search_params["max_incompleteness_penalty"] = (
                settings.DEFAULT_SEARCH_MAX_INCOMPLETENESS_PENALTY
            )
    search = construct_search(search_params)
    return search.execute().to_dict()


def subscribe_user_to_search_query(
    user, search_params, source_type=PercolateQuery.SEARCH_SUBSCRIPTION_TYPE
):
    """
    Subscribe a user to a search query


    Args:
        user: The User to subscribe
        search_params (dict): The opensearch query params returned from
        LearningResourcesSearchRequestSerializer

    Returns:
        dict: The opensearch response dict
    """
    adjusted_original_query = adjust_original_query_for_percolate(search_params)
    percolate_query, _ = PercolateQuery.objects.get_or_create(
        source_type=source_type,
        original_query=adjusted_original_query,
        query=adjust_query_for_percolator(adjusted_original_query),
    )
    if not percolate_query.users.filter(id=user.id).exists():
        percolate_query.users.add(user)
    return percolate_query


def unsubscribe_user_from_search_query(
    user, search_params, source_type=PercolateQuery.SEARCH_SUBSCRIPTION_TYPE
):
    """
    Unsubscribe a user to a search query


    Args:
        user: The User to unsubscribe
        search_params (dict): The opensearch query params returned from
        LearningResourcesSearchRequestSerializer

    Returns:
        dict: The opensearch response dict
    """
    adjusted_original_query = adjust_original_query_for_percolate(search_params)

    percolate_query = PercolateQuery.objects.filter(
        source_type=source_type,
        original_query=adjusted_original_query,
        query=adjust_query_for_percolator(adjusted_original_query),
    ).first()
    return unsubscribe_user_from_percolate_query(user, percolate_query)


def unsubscribe_user_from_percolate_query(user, percolate_query):
    """
    Unsubscribe a user to a search percolate query


    Args:
        user: The User to unsubscribe
        percolate_query: The PercolateQuery object to unsub from
    Returns:
        dict: The percolate query
    """
    if percolate_query.users.filter(id=user.id).exists():
        percolate_query.users.remove(user)
    return percolate_query


def user_subscribed_to_query(
    user, search_params, source_type=PercolateQuery.SEARCH_SUBSCRIPTION_TYPE
):
    """
    Check if a user is subscribed to a search query


    Args:
        user: The User to check
        search_params (dict): The opensearch query params returned from
        LearningResourcesSearchRequestSerializer

    Returns:
        bool: Whether or not the user has subscribed to the query
    """
    adjusted_original_query = adjust_original_query_for_percolate(search_params)
    percolate_query = PercolateQuery.objects.filter(
        source_type=source_type,
        original_query=adjusted_original_query,
    ).first()
    return (
        percolate_query.users.filter(id=user.id).exists() if percolate_query else False
    )


def get_similar_topics(
    value_doc: dict, num_topics: int, min_term_freq: int, min_doc_freq: int
) -> list[str]:
    """
    Get a list of similar topics based on text values

    Args:
        value_doc (dict):
            a document representing the data fields we want to search with
        num_topics (int):
            number of topics to return
        min_term_freq (int):
            minimum times a term needs to show up in input
        min_doc_freq (int):
            minimum times a term needs to show up in docs

    Returns:
        list of str:
            list of topic values
    """
    indexes = relevant_indexes([COURSE_TYPE], [], endpoint=LEARNING_RESOURCE)
    search = Search(index=",".join(indexes))
    search = search.filter("term", resource_type=COURSE_TYPE)
    search = search.query(
        MoreLikeThis(
            like=[{"doc": value_doc, "fields": list(value_doc.keys())}],
            fields=[
                "course.course_numbers.value",
                "title",
                "description",
                "full_description",
            ],
            min_term_freq=min_term_freq,
            min_doc_freq=min_doc_freq,
        )
    )
    search = search.source(includes="topics")

    response = search.execute()

    topics = [topic.to_dict()["name"] for hit in response.hits for topic in hit.topics]

    counter = Counter(topics)
    return list(dict(counter.most_common(num_topics)).keys())


def get_similar_resources(
    value_doc: dict,
    num_resources: int,
    min_term_freq: int,
    min_doc_freq: int,
    use_embeddings,
) -> list[str]:
    """
    Get a list of similar resources based on another resource

    Args:
        value_doc (dict):
            a document representing the data fields we want to search with
        num_topics (int):
            number of resources to return
        min_term_freq (int):
            minimum times a term needs to show up in input
        min_doc_freq (int):
            minimum times a term needs to show up in docs
        use_embeddings (bool):
            use vector embeddings to retrieve results

    Returns:
        list of str:
            list of topic values
    """
    if use_embeddings:
        return get_similar_resources_qdrant(value_doc, num_resources)
    return get_similar_resources_opensearch(
        value_doc, num_resources, min_term_freq, min_doc_freq
    )


def _qdrant_similar_results(doc, num_resources):
    """
    Get similar resources from qdrant

    Args:
        doc (dict):
            a document representing the data fields we want to search with
        num_resources (int):
            number of resources to return

    Returns:
        list of dict:
            list of serialized resources
    """
    from vector_search.utils import dense_encoder, qdrant_client, vector_point_id

    encoder = dense_encoder()
    client = qdrant_client()
    return [
        hit.payload
        for hit in client.query_points(
            collection_name=RESOURCES_COLLECTION_NAME,
            query=vector_point_id(doc["readable_id"]),
            limit=num_resources,
            using=encoder.model_short_name(),
        ).points
    ]


def get_similar_resources_qdrant(value_doc: dict, num_resources: int):
    """
    Get a list of similar resources from qdrant

    Args:
        value_doc (dict):
            a document representing the data fields we want to search with
        num_resources (int):
            number of resources to return

    Returns:
        list of str:
            list of learning resources
    """
    hits = _qdrant_similar_results(value_doc, num_resources)
    return (
        LearningResource.objects.for_search_serialization()
        .filter(
            readable_id__in=[
                resource["readable_id"] for resource in hits if resource["published"]
            ]
        )
        .exclude(id=value_doc["id"])
    )


def get_similar_resources_opensearch(
    value_doc: dict, num_resources: int, min_term_freq: int, min_doc_freq: int
) -> list[str]:
    """
    Get a list of similar resources from opensearch

    Args:
        value_doc (dict):
            a document representing the data fields we want to search with
        num_topics (int):
            number of resources to return
        min_term_freq (int):
            minimum times a term needs to show up in input
        min_doc_freq (int):
            minimum times a term needs to show up in docs

    Returns:
        list of str:
            list of learning resources
    """
    indexes = relevant_indexes(LEARNING_RESOURCE_TYPES, [], endpoint=LEARNING_RESOURCE)
    search = Search(index=",".join(indexes))
    if num_resources:
        # adding +1 to num_resources since we filter out existing resource.id
        search = search.extra(size=num_resources + 1)
    mlt_query = MoreLikeThis(
        like=[{"doc": value_doc, "fields": list(value_doc.keys())}],
        fields=[
            "course.course_numbers.value",
            "title",
            "description",
            "full_description",
        ],
        min_term_freq=min_term_freq,
        min_doc_freq=min_doc_freq,
    )
    # return only learning_resources
    search = search.query(
        "bool", must=[mlt_query], filter={"exists": {"field": "resource_type"}}
    )
    response = search.execute()
    return LearningResource.objects.for_search_serialization().filter(
        id__in=[
            resource.id for resource in response.hits if resource.id != value_doc["id"]
        ],
        published=True,
    )
