"""HubSpot proxy views."""

from django.conf import settings
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from hubspot.marketing.forms.exceptions import ApiException
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from main.permissions import IsSuperuserPermission
from ol_hubspot.api import get_form, list_forms


def _parse_bool(value: str | None) -> bool | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    if normalized in {"true", "1", "yes"}:
        return True
    if normalized in {"false", "0", "no"}:
        return False
    return None


def _to_dict(result):
    return result.to_dict() if hasattr(result, "to_dict") else result


def _missing_token_response() -> Response:
    return Response({}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


@extend_schema_view(
    get=extend_schema(
        parameters=[
            OpenApiParameter(name="after", type=str, required=False),
            OpenApiParameter(name="limit", type=int, required=False),
            OpenApiParameter(name="archived", type=bool, required=False),
            OpenApiParameter(name="form_types", type=str, required=False),
        ]
    )
)
@api_view(["GET"])
@permission_classes([IsSuperuserPermission])
def hubspot_forms_list_view(request):
    """List HubSpot forms from the backend."""
    if not settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN:
        return _missing_token_response()

    try:
        limit_value = request.query_params.get("limit")
        limit = int(limit_value) if limit_value else None
    except ValueError:
        return Response(
            {"limit": ["Must be an integer."]},
            status=status.HTTP_400_BAD_REQUEST,
        )

    archived_query_value = request.query_params.get("archived")
    archived = _parse_bool(archived_query_value)
    if archived_query_value is not None and archived is None:
        return Response(
            {"archived": ["Must be a boolean value."]},
            status=status.HTTP_400_BAD_REQUEST,
        )

    form_types = request.query_params.getlist("form_types")
    if not form_types:
        form_types_csv = request.query_params.get("form_types")
        form_types = [form_types_csv] if form_types_csv else None

    try:
        result = list_forms(
            access_token=settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN,
            after=request.query_params.get("after"),
            limit=limit,
            archived=archived,
            form_types=form_types,
        )
        return Response(_to_dict(result))
    except ApiException as exc:
        status_code = exc.status if isinstance(exc.status, int) else 502
        return Response({"detail": "HubSpot request failed"}, status=status_code)


@extend_schema_view(
    get=extend_schema(
        parameters=[OpenApiParameter(name="archived", type=bool, required=False)]
    )
)
@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def hubspot_form_detail_view(request, form_id: str):
    """Get one HubSpot form by id from the backend."""
    if not settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN:
        return _missing_token_response()

    archived_query_value = request.query_params.get("archived")
    archived = _parse_bool(archived_query_value)
    if archived_query_value is not None and archived is None:
        return Response(
            {"archived": ["Must be a boolean value."]},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        result = get_form(
            access_token=settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN,
            form_id=form_id,
            archived=archived,
        )
        return Response(_to_dict(result))
    except ApiException as exc:
        status_code = exc.status if isinstance(exc.status, int) else 502
        return Response({"detail": "HubSpot request failed"}, status=status_code)
