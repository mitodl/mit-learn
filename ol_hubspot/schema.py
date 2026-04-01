"""Schema helpers for HubSpot SDK-backed OpenAPI typing."""

from __future__ import annotations

from functools import cache

from hubspot.marketing.forms import models as hubspot_models
from rest_framework import serializers

MAX_NESTING_DEPTH = 5
SCALAR_FIELD_MAP: dict[str, type[serializers.Field]] = {
    "str": serializers.CharField,
    "int": serializers.IntegerField,
    "float": serializers.FloatField,
    "bool": serializers.BooleanField,
    "datetime": serializers.DateTimeField,
    "date": serializers.DateField,
}


def _to_pascal_case(value: str) -> str:
    return "".join(part[:1].upper() + part[1:] for part in value.split("_") if part)


def _singularize(value: str) -> str:
    if value.endswith("ies"):
        return f"{value[:-3]}y"
    if value.endswith(("xes", "ches", "shes", "sses", "zes")):
        return value[:-2]
    if value.endswith("s") and not value.endswith("ss"):
        return value[:-1]
    return value


def _path_segment_for_field(field_name: str, type_name: str) -> str:
    normalized_type = _normalize_type_name(type_name)
    if _list_inner_type(normalized_type) is not None:
        return f"{_to_pascal_case(_singularize(field_name))}Item"
    return _to_pascal_case(field_name)


def _serializer_name(
    path_segments: tuple[str, ...],
    *,
    truncate_complex: bool = False,
) -> str:
    if not path_segments:
        serializer_name = "Hubspot"
    else:
        # Collapse repeated prefixes: if the first segment starts with "hubspot",
        # skip the redundant prefix (e.g., HubSpotFormDefinition → FormDefinition,
        # then Hubspot + FormDefinition → HubspotFormDefinition)
        first_segment = path_segments[0]
        if first_segment.lower().startswith("hubspot"):
            # Remove the "hubspot" prefix from the first segment
            serializer_name = f"Hubspot{first_segment[7:]}"  # 7 = len("hubspot")
        else:
            serializer_name = f"Hubspot{first_segment}"

        # Add remaining segments
        serializer_name += "".join(path_segments[1:])

    if truncate_complex:
        serializer_name = f"{serializer_name}Truncated"
    return serializer_name


def _scalar_field(type_name: str) -> serializers.Field:
    field_cls = SCALAR_FIELD_MAP.get(type_name, serializers.JSONField)
    return field_cls(required=False, allow_null=True)


def _normalize_type_name(type_name: str) -> str:
    # The SDK sometimes emits optional unions like "str | None".
    if "|" not in type_name:
        return type_name

    narrowed = [part.strip() for part in type_name.split("|") if part.strip()]
    non_none = [part for part in narrowed if part != "None"]
    return non_none[0] if non_none else type_name


def _list_inner_type(type_name: str) -> str | None:
    if type_name.startswith("list[") and type_name.endswith("]"):
        return type_name[5:-1]
    return None


def _model_name(type_name: str) -> str | None:
    if hasattr(hubspot_models, type_name):
        return type_name
    return None


def _is_complex_type(type_name: str) -> bool:
    normalized_type = _normalize_type_name(type_name)
    return (
        _list_inner_type(normalized_type) is not None
        or _model_name(normalized_type) is not None
        or normalized_type.startswith("dict[")
    )


def _build_field(
    type_name: str,
    path_segments: tuple[str, ...],
    depth: int,
) -> serializers.Field:
    type_name = _normalize_type_name(type_name)

    if type_name in SCALAR_FIELD_MAP:
        return _scalar_field(type_name)

    if type_name.startswith("dict["):
        return serializers.JSONField(required=False, allow_null=True)

    list_inner = _list_inner_type(type_name)
    if list_inner is not None:
        child = _build_field(list_inner, path_segments, depth + 1)
        return serializers.ListField(child=child, required=False)

    model_name = _model_name(type_name)
    if model_name is not None:
        serializer_class = _serializer_class_for_model(
            model_name,
            path_segments=path_segments,
            depth=depth + 1,
            truncate_complex=depth >= MAX_NESTING_DEPTH,
        )
        return serializer_class(required=False)

    return _scalar_field(type_name)


@cache
def _serializer_class_for_model(
    model_name: str,
    path_segments: tuple[str, ...],
    depth: int = 0,
    *,
    truncate_complex: bool = False,
):
    model_cls = getattr(hubspot_models, model_name)
    openapi_types = getattr(model_cls, "openapi_types", {})

    attrs: dict[str, serializers.Field] = {}
    for field_name, type_name in openapi_types.items():
        if truncate_complex and _is_complex_type(type_name):
            continue
        field_segment = _path_segment_for_field(field_name, type_name)
        field_path_segments = (*path_segments, field_segment)
        attrs[field_name] = _build_field(type_name, field_path_segments, depth)

    serializer_name = _serializer_name(path_segments, truncate_complex=truncate_complex)
    return type(serializer_name, (serializers.Serializer,), attrs)


def serializer_for_hubspot_model(model_name: str):
    """Return a DRF serializer class generated from a HubSpot SDK model."""
    return _serializer_class_for_model(
        model_name,
        path_segments=(model_name,),
    )
