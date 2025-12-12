"""
OpenSearch connection functionality
"""

import uuid
from contextlib import suppress
from functools import partial

from django.conf import settings
from opensearch_dsl.connections import connections
from opensearchpy.exceptions import ConflictError

from learning_resources_search.constants import (
    ALL_INDEX_TYPES,
    IndexestoUpdate,
)


def configure_connections():
    """
    Create connections for the application

    This should only be called once
    """
    # this is the default connection
    http_auth = settings.OPENSEARCH_HTTP_AUTH
    use_ssl = http_auth is not None
    # configure() lazily creates connections when get_connection() is called
    connections.configure(
        default={
            "hosts": [settings.OPENSEARCH_URL],
            "http_auth": http_auth,
            "use_ssl": use_ssl,
            "timeout": settings.OPENSEARCH_DEFAULT_TIMEOUT,
            "connections_per_node": settings.OPENSEARCH_CONNECTIONS_PER_NODE,
            # make sure we verify SSL certificates (off by default)
            "verify_certs": use_ssl,
        }
    )


def get_conn():
    """
    Get the default connection

    Returns:
        opensearch.client.Opensearch: An OpenSearch client
    """
    return connections.get_connection()


def make_backing_index_name(object_type):
    """
    Make a unique name for use for a backing index

    Args:
        object_type(str): The object type (post, comment, profile)

    Returns:
        str: A new name for a backing index
    """
    return f"{settings.OPENSEARCH_INDEX}_{object_type}_{uuid.uuid4().hex}"


def make_alias_name(is_reindexing, object_type):
    """
    Make the name used for the Opensearch alias

    Args:
        object_type(str): The object type of the index (post, comment, etc)
        is_reindexing (bool): If true, use the alias name meant for reindexing

    Returns:
        str: The name of the alias
    """
    return "{prefix}_{object_type}_{suffix}".format(
        prefix=settings.OPENSEARCH_INDEX,
        object_type=object_type,
        suffix="reindexing" if is_reindexing else "default",
    )


get_default_alias_name = partial(make_alias_name, False)  # noqa: FBT003
get_reindexing_alias_name = partial(make_alias_name, True)  # noqa: FBT003


def get_active_aliases(
    conn, *, object_types=None, index_types=IndexestoUpdate.all_indexes.value
):
    """
    Return aliases which exist for specified object types

    Args:
        conn(opensearch.client.Opensearch): An Opensearch client
        object_types(list of str): list of object types (post, comment, etc)
        indexes(string): one of IndexestoUpdate, whether the default index,
            the reindexing index or both sould be returned for each resource type

    Returns:
        list of str: Aliases which exist
    """
    if not object_types:
        object_types = ALL_INDEX_TYPES

    if index_types == IndexestoUpdate.all_indexes.value:
        return [
            alias
            for alias_tuple in [
                (get_default_alias_name(obj), get_reindexing_alias_name(obj))
                for obj in object_types
            ]
            for alias in alias_tuple
            if conn.indices.exists(alias)
        ]

    elif index_types == IndexestoUpdate.current_index.value:
        return [
            alias
            for alias in [get_default_alias_name(obj) for obj in object_types]
            if conn.indices.exists(alias)
        ]
    elif index_types == IndexestoUpdate.reindexing_index.value:
        return [
            alias
            for alias in [get_reindexing_alias_name(obj) for obj in object_types]
            if conn.indices.exists(alias)
        ]
    return None


def refresh_index(index):
    """
    Refresh the opensearch index

    Args:
        index (str): The opensearch index to refresh
    """
    conn = get_conn()
    conn.indices.refresh(index)


def create_openai_embedding_connector_and_model(
    model_name=settings.OPENSEARCH_VECTOR_MODEL_BASE_NAME,
    openai_model=settings.QDRANT_DENSE_MODEL,
):
    """
    Create OpenAI embedding connector and model for opensearch vector search.
    The model will be used to generate embeddings for user queries

    Args:
        model_name: Name param for the model in opensearch
        openai_model: Name of the OpenAI model that will be loaded
    """

    conn = get_conn()

    body = {
        "name": f"{model_name}_connector",
        "description": "openAI Embedding Connector ",
        "version": "0.1",
        "protocol": "http",
        "parameters": {
            "model": openai_model,
        },
        "credential": {"openAI_key": settings.OPENAI_API_KEY},
        "actions": [
            {
                "action_type": "predict",
                "method": "POST",
                "url": "https://api.openai.com/v1/embeddings",
                "headers": {
                    "Authorization": "Bearer ${credential.openAI_key}",
                },
                "request_body": '{"input": ${parameters.input}, "model": "${parameters.model}" }',  # noqa: E501
                "pre_process_function": "connector.pre_process.openai.embedding",
                "post_process_function": "connector.post_process.openai.embedding",
            }
        ],
    }

    connector_response = conn.transport.perform_request(
        "POST", "/_plugins/_ml/connectors/_create", body=body
    )

    connector_id = connector_response["connector_id"]

    model_group_response = conn.transport.perform_request(
        "POST",
        "/_plugins/_ml/model_groups/_register",
        body={
            "name": f"{model_name}_group",
            "description": "OpenAI Embedding Model Group",
        },
    )

    model_group_id = model_group_response["model_group_id"]

    conn.transport.perform_request(
        "POST",
        "/_plugins/_ml/models/_register",
        body={
            "name": model_name,
            "function_name": "remote",
            "model_group_id": model_group_id,
            "description": "OpenAI embedding model",
            "connector_id": connector_id,
        },
    )


def get_vector_model_id(model_name=settings.OPENSEARCH_VECTOR_MODEL_BASE_NAME):
    """
    Get the model ID for the currently loaded opensearch vector model
    Args:
        model_name: Name of the model to get the id for
    Returns:
        str or None: The model ID if found, else None
    """
    conn = get_conn()
    body = {"query": {"term": {"name.keyword": model_name}}}
    models = conn.transport.perform_request(
        "GET", "/_plugins/_ml/models/_search", body=body
    )

    if len(models.get("hits", {}).get("hits", [])) > 0:
        return models["hits"]["hits"][0]["_id"]

    return None


def deploy_vector_model(model_name=settings.OPENSEARCH_VECTOR_MODEL_BASE_NAME):
    """
    Deploy an opensearch vector model

    Args:
        model_name: Name of the model to deploy
    """
    conn = get_conn()
    model_id = get_vector_model_id(model_name=model_name)
    conn.transport.perform_request("POST", f"/_plugins/_ml/models/{model_id}/_deploy")


def cleanup_vector_models(
    exclude_model_names=[settings.OPENSEARCH_VECTOR_MODEL_BASE_NAME],  # noqa: B006
):
    """
    Delete an opensearch vector models. If exclude_model_name is provided,
    do not delete that model.

    Args:
        exclude_model_names: List of names of the models to keep or None
    """
    conn = get_conn()
    body = {"query": {"match_all": {}}}
    models_response = conn.transport.perform_request(
        "GET", "/_plugins/_ml/models/_search", body=body
    )

    deleted_models = []
    for model in models_response.get("hits", {}).get("hits", []):
        model_id = model.get("_id")
        model_name = model.get("_source", {}).get("name")
        model_group_id = model.get("_source", {}).get("model_group_id")
        connector_id = model.get("_source", {}).get("connector_id")

        if model_name not in (exclude_model_names or []):
            if model.get("_source", {}).get("model_state") == "DEPLOYED":
                conn.transport.perform_request(
                    "POST", f"/_plugins/_ml/models/{model_id}/_undeploy"
                )

            conn.transport.perform_request("DELETE", f"/_plugins/_ml/models/{model_id}")
            deleted_models.append(model_name)

            if model_group_id:
                # ConflictError is raised if other models still use the group
                with suppress(ConflictError):
                    conn.transport.perform_request(
                        "DELETE", f"/_plugins/_ml/model_groups/{model_group_id}"
                    )

            if connector_id:
                # ConflictError is raised if other models still use the connector
                with suppress(ConflictError):
                    conn.transport.perform_request(
                        "DELETE", f"/_plugins/_ml/connectors/{connector_id}"
                    )

    return deleted_models
