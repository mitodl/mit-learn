import asyncio
import logging
from functools import wraps
from itertools import chain

import pandas as pd
from asgiref.sync import sync_to_async
from django.conf import settings
from django.utils.decorators import method_decorator
from drf_spectacular.utils import extend_schema, extend_schema_view
from qdrant_client import models
from qdrant_client.http.exceptions import UnexpectedResponse
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from authentication.decorators import blocked_ip_exempt
from learning_resources.constants import GROUP_CONTENT_FILE_CONTENT_VIEWERS
from main.utils import cache_page_for_anonymous_users
from vector_search.constants import (
    CONTENT_FILES_COLLECTION_NAME,
    CONTENT_FILES_RETRIEVE_PAYLOAD,
    RESOURCES_COLLECTION_NAME,
    RESOURCES_RETRIEVE_PAYLOAD,
)
from vector_search.serializers import (
    ContentFileVectorSearchRequestSerializer,
    ContentFileVectorSearchResponseSerializer,
    LearningResourcesVectorSearchRequestSerializer,
    LearningResourcesVectorSearchResponseSerializer,
)
from vector_search.utils import (
    _content_file_vector_hits,
    _merge_dicts,
    _resource_vector_hits,
    async_qdrant_aggregations,
    async_qdrant_client,
    dense_encoder,
    qdrant_query_conditions,
    sparse_encoder,
)

log = logging.getLogger(__name__)


class QdrantView(APIView):
    """
    Parent class for views that execute ES searches
    """

    @classmethod
    def as_view(cls, **initkwargs):
        view = super().as_view(**initkwargs)

        @wraps(view)
        async def async_view(*args, **kwargs):
            return await view(*args, **kwargs)

        async_view.view_is_async = True
        return async_view

    async def dispatch(self, request, *args, **kwargs):
        self.args = args
        self.kwargs = kwargs
        request = self.initialize_request(request, *args, **kwargs)
        self.request = request
        self.headers = self.default_response_headers

        try:
            await sync_to_async(self.initial)(request, *args, **kwargs)

            if request.method.lower() in self.http_method_names:
                handler = getattr(
                    self, request.method.lower(), self.http_method_not_allowed
                )
            else:
                handler = self.http_method_not_allowed

            response = handler(request, *args, **kwargs)

            if asyncio.iscoroutine(response):
                response = await response

        except Exception as exc:  # noqa: BLE001
            response = self.handle_exception(exc)

        self.response = self.finalize_response(request, response, *args, **kwargs)
        return self.response

    def _format_order_by(self, order_by_parameter):
        sort = models.Direction.ASC
        if order_by_parameter.startswith("-") and len(order_by_parameter) > 1:
            order_by_parameter = order_by_parameter.lstrip("-")
            sort = models.Direction.DESC
        return models.OrderBy(key=order_by_parameter, direction=sort)

    async def _build_search_params(  # noqa: PLR0913
        self,
        query_string: str,
        search_collection: str,
        search_filter,
        limit: int,
        prefetch_limit: int,
        order_by: str,
        encoder_dense,
        encoder_sparse,
        hybrid_search,
        score_cutoff: float = 0.0,
    ):
        search_params = {
            "collection_name": search_collection,
            "query_filter": search_filter,
            "with_vectors": False,
            "with_payload": RESOURCES_RETRIEVE_PAYLOAD
            if search_collection == RESOURCES_COLLECTION_NAME
            else CONTENT_FILES_RETRIEVE_PAYLOAD,
            "search_params": models.SearchParams(
                quantization=models.QuantizationSearchParams(
                    ignore=False,
                    rescore=True,
                    oversampling=1,
                ),
                hnsw_ef=64,
                indexed_only=True,
                exact=False,
            ),
            "limit": limit,
            "score_threshold": score_cutoff,
        }

        if hybrid_search:
            sparse_query, dense_query = await asyncio.gather(
                sync_to_async(encoder_sparse.embed, thread_sensitive=False)(
                    query_string
                ),
                sync_to_async(encoder_dense.embed_query, thread_sensitive=False)(
                    query_string
                ),
            )
            if order_by:
                # Nest: vector prefetches → fusion prefetch → order_by query
                search_params["prefetch"] = models.Prefetch(
                    prefetch=[
                        models.Prefetch(
                            filter=search_filter,
                            query=sparse_query,
                            using=encoder_sparse.model_short_name(),
                            limit=prefetch_limit,
                        ),
                        models.Prefetch(
                            filter=search_filter,
                            query=dense_query,
                            using=encoder_dense.model_short_name(),
                            limit=prefetch_limit,
                        ),
                    ],
                    query=models.FusionQuery(fusion=models.Fusion.RRF),
                    limit=prefetch_limit,
                )
                search_params["query"] = models.OrderByQuery(
                    order_by=self._format_order_by(order_by)
                )
            else:
                search_params["prefetch"] = [
                    models.Prefetch(
                        filter=search_filter,
                        query=sparse_query,
                        using=encoder_sparse.model_short_name(),
                        limit=prefetch_limit,
                    ),
                    models.Prefetch(
                        filter=search_filter,
                        query=dense_query,
                        using=encoder_dense.model_short_name(),
                        limit=prefetch_limit,
                    ),
                ]
                search_params["query"] = models.FusionQuery(fusion=models.Fusion.RRF)
        else:
            dense_query = await sync_to_async(encoder_dense.embed_query)(query_string)
            if order_by:
                # Nest: dense vector prefetch → order_by query
                search_params["prefetch"] = models.Prefetch(
                    query=dense_query,
                    using=encoder_dense.model_short_name(),
                    limit=prefetch_limit,
                )
                search_params["query"] = models.OrderByQuery(
                    order_by=self._format_order_by(order_by)
                )
            else:
                search_params["using"] = encoder_dense.model_short_name()
                search_params["query"] = dense_query

        return search_params

    async def _execute_group_search(self, client, search_params, params):
        search_params.pop("search_params", None)
        search_params["group_by"] = params.get("group_by")
        search_params["group_size"] = params.get("group_size", 1)
        search_params["with_payload"] = True
        group_result = await client.query_points_groups(**search_params)
        search_result = []
        for group in group_result.groups:
            payloads = [hit.payload for hit in group.hits]
            response_hit = _merge_dicts(payloads)
            chunks = [payload.get("chunk_content") for payload in payloads]
            response_hit["chunk_content"] = None
            response_hit["chunks"] = chunks
            response_row = {
                "id": response_hit[search_params["group_by"]],
                "payload": response_hit,
                "vector": [],
            }
            search_result.append(models.PointStruct(**response_row))
        return search_result

    async def _execute_scroll_search(  # noqa: PLR0913
        self,
        client,
        search_collection,
        search_filter,
        limit,
        offset,
        order_by,
    ):
        # Build common scroll kwargs
        scroll_kwargs = {
            "collection_name": search_collection,
            "scroll_filter": search_filter,
            "with_vectors": False,
        }

        if order_by:
            # Qdrant disables pagination (next_page_offset) when order_by
            # is used.  Fetch offset+limit results in one call and slice
            # on the client side.
            scroll_kwargs["order_by"] = self._format_order_by(order_by)
            scroll_res = await client.scroll(
                **scroll_kwargs,
                limit=offset + limit,
            )
            page_points, _ = scroll_res
            return page_points[offset : offset + limit]

        # Standard pagination loop for non-ordered scrolls
        remaining_to_skip = offset
        next_page_offset = None
        search_result = []

        while True:
            fetch_size = min(max(remaining_to_skip, limit), 1000)
            scroll_res = await client.scroll(
                **scroll_kwargs,
                limit=fetch_size,
                offset=next_page_offset,
            )
            page_points, next_page_offset = scroll_res
            if remaining_to_skip > 0:
                skipped = min(remaining_to_skip, len(page_points))
                page_points = page_points[skipped:]
                remaining_to_skip -= skipped
            search_result.extend(page_points)
            if len(search_result) >= limit or not next_page_offset:
                break
        return search_result[:limit]

    async def _async_vector_hits(  # noqa: PLR0913
        self,
        query_string: str,
        params: dict,
        order_by: str | None = None,
        limit: int = 10,
        offset: int = 0,
        search_collection=RESOURCES_COLLECTION_NAME,
        score_cutoff: float = 0,
        *,
        hybrid_search: bool = False,
    ):
        """
        Execute vector search and return hydrated hits
        """
        client = async_qdrant_client()
        encoder_dense = dense_encoder()
        encoder_sparse = sparse_encoder()

        # enable caching
        encoder_dense.cache = True

        search_filter = qdrant_query_conditions(
            params, collection_name=search_collection
        )

        if query_string:
            prefetch_multiplier = getattr(
                settings, "VECTOR_HYBRID_SEARCH_PREFETCH_MULTIPLIER", 20
            )
            prefetch_limit = (offset + limit) * prefetch_multiplier
            prefetch_max_limit = getattr(
                settings, "VECTOR_HYBRID_SEARCH_PREFETCH_MAX_LIMIT", None
            )
            if prefetch_max_limit is not None:
                prefetch_limit = min(prefetch_limit, prefetch_max_limit)

            search_params = await self._build_search_params(
                query_string,
                search_collection,
                search_filter,
                limit,
                prefetch_limit,
                order_by,
                encoder_dense,
                encoder_sparse,
                hybrid_search,
                score_cutoff,
            )

            if "group_by" in params:
                search_result = await self._execute_group_search(
                    client, search_params, params
                )
            elif order_by:
                # Qdrant's query_points does not support offset with
                # OrderByQuery.  Fetch offset+limit results and slice
                # manually on the client side.
                search_params["limit"] = offset + limit
                result_obj = await client.query_points(**search_params)
                search_result = result_obj.points[offset : offset + limit]
            else:
                search_params["offset"] = offset
                result_obj = await client.query_points(**search_params)
                search_result = result_obj.points
        else:
            # No query string — use scroll API
            search_result = await self._execute_scroll_search(
                client,
                search_collection,
                search_filter,
                limit,
                offset,
                order_by,
            )

        if search_collection == RESOURCES_COLLECTION_NAME:
            return await sync_to_async(_resource_vector_hits)(search_result)
        else:
            return await sync_to_async(_content_file_vector_hits)(search_result)

    def _extract_values(self, obj, qdrant_field):
        """
        Extract values from a nested dictionary based on a path like 'topics[].name'
        """
        if not qdrant_field:
            return []

        parts = qdrant_field.split(".")
        values = [obj]

        for part in parts:
            is_array = part.endswith("[]")
            key = part[:-2] if is_array else part

            next_values = []
            for v in values:
                if not isinstance(v, dict):
                    continue
                item = v.get(key)
                if item is None:
                    continue

                if isinstance(item, list):
                    next_values.extend(item)
                else:
                    next_values.append(item)
            values = next_values

        return values

    async def _async_vector_resource_counts(
        self, hits, params, search_collection=RESOURCES_COLLECTION_NAME
    ):
        total_count = len(hits)
        aggregation_keys = params.get("aggregations") or []
        aggregations = {}

        if not aggregation_keys or not hits:
            return {
                "total": {"value": total_count},
                "aggregations": aggregations,
            }

        from vector_search.constants import (
            COLLECTION_PARAM_MAP,
            QDRANT_RESOURCE_PARAM_MAP,
        )

        param_map = COLLECTION_PARAM_MAP.get(
            search_collection, QDRANT_RESOURCE_PARAM_MAP
        )

        for agg_key in aggregation_keys:
            qdrant_field = param_map.get(agg_key)
            if not qdrant_field:
                continue

            extracted = []
            for hit in hits:
                values = set()
                for val in self._extract_values(hit, qdrant_field):
                    if isinstance(val, (str, int, float, bool)):
                        values.add(val)
                extracted.extend(list(values))

            if extracted:
                series = pd.Series(extracted)

                def format_key(val):
                    if isinstance(val, bool):
                        return str(val).lower()
                    return str(val)

                counts = series.apply(format_key).value_counts()

                aggregations[agg_key] = [
                    {"key": str(k), "doc_count": int(v)} for k, v in counts.items()
                ]
            else:
                aggregations[agg_key] = []

        return {
            "total": {"value": total_count},
            "aggregations": aggregations,
        }

    async def _async_vector_counts(
        self,
        params: dict,
        search_collection=RESOURCES_COLLECTION_NAME,
    ):
        """
        Compute total count and aggregations/facets
        """
        client = async_qdrant_client()
        search_filter = qdrant_query_conditions(
            params, collection_name=search_collection
        )
        aggregation_keys = params.get("aggregations") or []

        count_result, aggregations = await asyncio.gather(
            client.count(
                collection_name=search_collection,
                count_filter=search_filter,
                exact=False,
            ),
            async_qdrant_aggregations(
                aggregation_keys,
                params,
                collection_name=search_collection,
            ),
        )

        return {
            "total": {"value": count_result.count},
            "aggregations": aggregations or {},
        }

    async def async_vector_search(  # noqa: PLR0913
        self,
        query_string: str,
        params: dict,
        order_by: str | None = None,
        limit: int = 10,
        offset: int = 0,
        search_collection=RESOURCES_COLLECTION_NAME,
        score_cutoff: float = 0,
        *,
        hybrid_search: bool = False,
    ):
        if query_string and score_cutoff > 0:
            counts = await self._async_vector_counts(
                params,
                search_collection=search_collection,
            )
            total_count = counts["total"]["value"]
            if total_count == 0:
                return {
                    "hits": [],
                    **counts,
                }
            hits = await self._async_vector_hits(
                query_string,
                params,
                order_by=order_by,
                limit=total_count,
                offset=0,
                search_collection=search_collection,
                score_cutoff=score_cutoff,
                hybrid_search=hybrid_search,
            )
            counts = await self._async_vector_resource_counts(
                hits, params, search_collection=search_collection
            )

            return {
                "hits": hits,
                **counts,
            }

        hits, counts = await asyncio.gather(
            self._async_vector_hits(
                query_string,
                params,
                order_by=order_by,
                limit=limit,
                offset=offset,
                search_collection=search_collection,
                score_cutoff=score_cutoff,
                hybrid_search=hybrid_search,
            ),
            self._async_vector_counts(
                params,
                search_collection=search_collection,
            ),
        )

        return {
            "hits": hits,
            **counts,
        }

    def handle_exception(self, exc):
        if isinstance(exc, UnexpectedResponse) and (
            isinstance(exc.status_code, int) and 400 <= exc.status_code < 500  # noqa: PLR2004
        ):
            log.exception("Received a 4xx error from Qdrant")
            return Response(status=exc.status_code)
        raise exc


@method_decorator(blocked_ip_exempt, name="dispatch")
@extend_schema_view(
    get=extend_schema(
        parameters=[LearningResourcesVectorSearchRequestSerializer()],
        responses=LearningResourcesVectorSearchResponseSerializer(),
    ),
)
@action(methods=["GET"], detail=False, name="Search Learning Resources")
class LearningResourcesVectorSearchView(QdrantView):
    """
    Vector Search for learning resources
    """

    permission_classes = ()

    @method_decorator(
        cache_page_for_anonymous_users(
            settings.REDIS_VIEW_CACHE_DURATION,
            cache="redis",
            key_prefix="vector_search",
        )
    )
    @extend_schema(summary="Vector Search")
    async def get(self, request):
        request_data = LearningResourcesVectorSearchRequestSerializer(data=request.GET)

        if request_data.is_valid():
            query_text = request_data.data.get("q", "")
            hybrid_search = request_data.data.get("hybrid_search", False)
            limit = request_data.data.get("limit", 10)
            offset = request_data.data.get("offset", 0)
            order_by = request_data.data.get("sortby")
            response = await self.async_vector_search(
                query_text,
                order_by=order_by,
                limit=limit,
                offset=offset,
                params=request_data.data,
                hybrid_search=hybrid_search,
                score_cutoff=request_data.data.get("score_cutoff", 0),
            )
            if request_data.data.get("dev_mode"):
                return Response(response)
            else:

                def serialize():
                    return LearningResourcesVectorSearchResponseSerializer(
                        response, context={"request": request}
                    ).data

                response_data = await sync_to_async(serialize)()
                response_data["results"] = list(response_data["results"])
                return Response(response_data)
        else:
            errors = {}
            for key, errors_obj in request_data.errors.items():
                if isinstance(errors_obj, list):
                    errors[key] = errors_obj
                else:
                    errors[key] = list(set(chain(*errors_obj.values())))
            return Response(errors, status=400)


@method_decorator(blocked_ip_exempt, name="dispatch")
@extend_schema_view(
    get=extend_schema(
        parameters=[ContentFileVectorSearchRequestSerializer()],
        responses=ContentFileVectorSearchResponseSerializer(),
    ),
)
@action(methods=["GET"], detail=False, name="Search Content Files")
class ContentFilesVectorSearchView(QdrantView):
    """
    Vector Search for content
    """

    class IsAdminOrContentFileContentViewer(BasePermission):
        def has_permission(self, request, view):  # noqa: ARG002
            user = request.user
            if not user or not user.is_authenticated:
                return False
            if user.is_staff or user.is_superuser:
                return True
            return user.groups.filter(name=GROUP_CONTENT_FILE_CONTENT_VIEWERS).exists()

    permission_classes = (IsAdminOrContentFileContentViewer,)

    @method_decorator(
        cache_page_for_anonymous_users(
            settings.REDIS_VIEW_CACHE_DURATION,
            cache="redis",
            key_prefix="vector_search",
        )
    )
    @extend_schema(summary="Content File Vector Search")
    async def get(self, request):
        request_data = ContentFileVectorSearchRequestSerializer(data=request.GET)

        if request_data.is_valid():
            query_text = request_data.data.get("q", "")
            hybrid_search = request_data.data.get("hybrid_search", False)
            limit = request_data.data.get("limit", 10)
            offset = request_data.data.get("offset", 0)
            collection_name_override = request_data.data.get("collection_name")
            collection_name = CONTENT_FILES_COLLECTION_NAME
            if collection_name_override:
                collection_name = (
                    f"{settings.QDRANT_BASE_COLLECTION_NAME}.{collection_name_override}"
                )

            response = await self.async_vector_search(
                query_text,
                limit=limit,
                offset=offset,
                params=request_data.data,
                search_collection=collection_name,
                hybrid_search=hybrid_search,
            )
            if request_data.data.get("dev_mode"):
                return Response(response)
            else:

                def serialize():
                    return ContentFileVectorSearchResponseSerializer(
                        response, context={"request": request}
                    ).data

                response_data = await sync_to_async(serialize)()
                response_data["results"] = list(response_data["results"])
                return Response(response_data)
        else:
            errors = {}
            for key, errors_obj in request_data.errors.items():
                if isinstance(errors_obj, list):
                    errors[key] = errors_obj
                else:
                    errors[key] = list(set(chain(*errors_obj.values())))
            return Response(errors, status=400)
