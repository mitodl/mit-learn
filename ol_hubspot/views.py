"""HubSpot proxy views."""

from urllib.parse import parse_qs, unquote, urlencode, urlparse

from django.conf import settings
from django.urls import reverse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from hubspot.marketing.forms.exceptions import ApiException
from ipware import get_client_ip
from rest_framework import permissions, serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from main.permissions import IsSuperuserPermission
from ol_hubspot.api import get_form, list_forms, submit_form, verify_recaptcha
from ol_hubspot.schema import serializer_for_hubspot_model

hubspot_forms_list_response_schema = serializer_for_hubspot_model(
    "CollectionResponseFormDefinitionBaseForwardPaging"
)
hubspot_form_detail_response_schema = serializer_for_hubspot_model(
    "HubSpotFormDefinition"
)

hubspot_error_responses = {
    400: OpenApiTypes.OBJECT,
    503: OpenApiTypes.OBJECT,
    "4XX": OpenApiTypes.OBJECT,
    "5XX": OpenApiTypes.OBJECT,
}


class HubspotFormFieldValueSerializer(serializers.Serializer):
    """Serializer for individual form field values in submission."""

    name = serializers.CharField(required=True)
    value = serializers.JSONField(required=True, allow_null=True)

    def validate_value(self, value):
        """Ensure value is one of the allowed types."""
        if value is None:
            return value
        if isinstance(value, (str, bool)):
            return value
        if isinstance(value, list) and all(isinstance(v, str) for v in value):
            return value
        msg = "Value must be a string, boolean, array of strings, or null."
        raise serializers.ValidationError(msg)


class HubspotFormSubmitRequestSerializer(serializers.Serializer):
    """Serializer for HubSpot form submission requests."""

    fields = serializers.ListField(
        child=HubspotFormFieldValueSerializer(),
        required=True,
    )
    page_uri = serializers.URLField(required=False)
    hutk = serializers.CharField(required=False, allow_blank=True)
    page_name = serializers.CharField(required=False, allow_blank=True)
    submitted_at = serializers.IntegerField(required=False, min_value=0)
    recaptcha_token = serializers.CharField(required=False, allow_blank=False)
    # Backward-compatible aliases
    page_title = serializers.CharField(required=False, allow_blank=True)
    timestamp = serializers.IntegerField(required=False, min_value=0)


def _extract_client_ip(request) -> str | None:
    """Best-effort extraction of client IP across local/proxy setups."""
    client_ip, _ = get_client_ip(request)
    if client_ip:
        return client_ip

    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded_for:
        first_ip = forwarded_for.split(",")[0].strip()
        if first_ip:
            return first_ip

    real_ip = request.META.get("HTTP_X_REAL_IP")
    if real_ip:
        return real_ip

    cf_connecting_ip = request.META.get("HTTP_CF_CONNECTING_IP")
    if cf_connecting_ip:
        return cf_connecting_ip

    remote_addr = request.META.get("REMOTE_ADDR")
    return remote_addr or None


class HubspotFormSubmitResponseSerializer(serializers.Serializer):
    """Serializer for HubSpot form submission response."""

    status = serializers.CharField(default="submitted")


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


def _normalize_forms_paging(request, payload: dict) -> dict:
    """Rewrite HubSpot paging links to point at this proxy endpoint."""
    paging = payload.get("paging")
    if not isinstance(paging, dict):
        return payload

    next_page = paging.get("next")
    if not isinstance(next_page, dict):
        return payload

    after = None
    next_link = next_page.get("link")
    if isinstance(next_link, str) and next_link:
        parsed = urlparse(next_link)
        parsed_query = parse_qs(parsed.query)
        after = (parsed_query.get("after") or [None])[0]

    if not after:
        raw_after = next_page.get("after")
        if isinstance(raw_after, str) and raw_after:
            after = unquote(raw_after)

    if not after:
        return payload

    # Keep list options stable between pages while switching link host/path to this API.
    next_query_params = {
        "after": after,
    }
    for key in ("limit", "archived"):
        value = request.query_params.get(key)
        if value is not None:
            next_query_params[key] = value
    form_types = request.query_params.getlist("form_types")
    if form_types:
        next_query_params["form_types"] = form_types

    base_path = reverse("ol_hubspot:v1:hubspot-forms-list")
    query_string = urlencode(next_query_params, doseq=True)
    next_page["link"] = request.build_absolute_uri(f"{base_path}?{query_string}")

    return payload


def _missing_token_response() -> Response:
    return Response({}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


def _enrich_submit_request_data(request) -> dict:
    """Inject server-side context into the raw submission data before validation."""
    data = dict(request.data)
    if not data.get("page_uri"):
        referer = request.META.get("HTTP_REFERER")
        if referer:
            data["page_uri"] = referer
    if not data.get("hutk"):
        hutk_cookie = request.COOKIES.get("hubspotutk")
        if hutk_cookie:
            data["hutk"] = hutk_cookie
    return data


def _resolve_payload_aliases(payload: dict) -> dict:
    """Resolve backward-compatible field aliases in the validated payload."""
    if payload.get("page_name") is None and payload.get("page_title") is not None:
        payload["page_name"] = payload["page_title"]
    if payload.get("submitted_at") is None and payload.get("timestamp") is not None:
        payload["submitted_at"] = payload["timestamp"]
    return payload


@extend_schema(
    operation_id="hubspot_forms_list",
    responses={200: hubspot_forms_list_response_schema, **hubspot_error_responses},
    parameters=[
        OpenApiParameter(name="after", type=str, required=False),
        OpenApiParameter(name="limit", type=int, required=False),
        OpenApiParameter(name="archived", type=bool, required=False),
        OpenApiParameter(name="form_types", type=str, required=False, many=True),
    ],
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

    form_types = request.query_params.getlist("form_types") or None

    try:
        result = list_forms(
            after=request.query_params.get("after"),
            limit=limit,
            archived=archived,
            form_types=form_types,
        )
        return Response(_normalize_forms_paging(request, _to_dict(result)))
    except ApiException as exc:
        status_code = exc.status if isinstance(exc.status, int) else 502
        return Response({"detail": "HubSpot request failed"}, status=status_code)


@extend_schema(
    operation_id="hubspot_forms_detail_retrieve",
    responses={200: hubspot_form_detail_response_schema, **hubspot_error_responses},
    parameters=[OpenApiParameter(name="archived", type=bool, required=False)],
)
@api_view(["GET"])
@permission_classes([permissions.AllowAny])
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
            form_id=form_id,
            archived=archived,
        )
        return Response(_to_dict(result))
    except ApiException as exc:
        status_code = exc.status if isinstance(exc.status, int) else 502
        return Response({"detail": "HubSpot request failed"}, status=status_code)


@extend_schema(
    operation_id="hubspot_forms_submit",
    request=HubspotFormSubmitRequestSerializer(),
    responses={200: HubspotFormSubmitResponseSerializer(), **hubspot_error_responses},
)
@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def hubspot_form_submit_view(request, form_id: str):
    """Submit a form to HubSpot."""
    if not settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN:
        return _missing_token_response()

    serializer = HubspotFormSubmitRequestSerializer(
        data=_enrich_submit_request_data(request)
    )
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    try:
        payload = _resolve_payload_aliases(dict(serializer.validated_data))
        client_ip = _extract_client_ip(request)
        if client_ip:
            payload["ip_address"] = client_ip
        recaptcha_token = payload.pop("recaptcha_token", None)
        if recaptcha_token and not verify_recaptcha(
            recaptcha_token,
            remote_ip=payload.get("ip_address"),
        ):
            return Response(
                {"recaptcha_token": ["reCAPTCHA verification failed."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        submit_form(form_id=form_id, payload=payload)
        return Response(
            HubspotFormSubmitResponseSerializer({"status": "submitted"}).data,
            status=status.HTTP_200_OK,
        )
    except ApiException as exc:
        status_code = exc.status if isinstance(exc.status, int) else 502
        return Response({"detail": "HubSpot request failed"}, status=status_code)
