"""Extensions to drf-spectacular schema"""

from typing import Any

from drf_spectacular.extensions import (
    OpenApiSerializerExtension,
)
from drf_spectacular.plumbing import get_class


class VersionedSerializerExtension(OpenApiSerializerExtension):
    """
    Serializer extension that transforms the schema between different API versions
    """

    target_class = "drf_versioning.serializers.versioned_serializer.VersionedSerializer"
    match_subclasses = True

    @classmethod
    def _matches(cls, target: Any) -> bool:
        """Ignore the base class because it will fail and isn't a valid target"""
        return super()._matches(target) and get_class(target) != cls.target_class

    def map_serializer(self, auto_schema, direction):
        """Map a given serializer by transforming it to a specified version"""
        schema = auto_schema._map_serializer(  # noqa: SLF001
            self.target, direction, bypass_extensions=True
        )

        version = auto_schema.view.request.version
        transforms = self.target.transforms_for_version(version)

        for transform in transforms:
            if direction == "request":
                schema = transform().schema_to_internal_value(schema)
            elif direction == "response":
                schema = transform().schema_to_representation(schema)

        return schema
