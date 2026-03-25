"""v2 transforms for learning_resources serializers.

These transforms maintain backwards compatibility for v1 clients when
the v2 API introduces breaking changes.

"""

from mitol.api_versioning.transforms import Transform


class DepartmentRenameChannelUrlToUrl(Transform):
    """v2 renames channel_url to url on LearningResourceBaseDepartmentSerializer."""

    version = "v2"
    description = "Rename channel_url to url on Department"
    serializer = (
        "learning_resources.serializers.LearningResourceBaseDepartmentSerializer"
    )

    def to_representation(self, data, request, instance):  # noqa: ARG002
        """Rename url back to channel_url for v1 clients."""
        if "url" in data:
            data["channel_url"] = data.pop("url")
        return data

    def to_internal_value(self, data, request):  # noqa: ARG002
        """Convert channel_url from v1 clients to url for v2."""
        if "channel_url" in data:
            data["url"] = data.pop("channel_url")
        return data

    def transform_schema(self, schema, direction):
        """Swap url/channel_url in schema."""
        if direction == "backwards":
            props = schema.get("properties", {})
            if "url" in props:
                props["channel_url"] = props.pop("url")
            required = schema.get("required", [])
            if "url" in required:
                idx = required.index("url")
                required[idx] = "channel_url"
        return schema


class RunAddEnrollmentUrl(Transform):
    """v2 adds enrollment_url to LearningResourceRunSerializer."""

    version = "v2"
    description = "Add enrollment_url field to Run"
    serializer = "learning_resources.serializers.LearningResourceRunSerializer"

    def to_representation(self, data, request, instance):  # noqa: ARG002
        """Remove enrollment_url for v1 clients."""
        data.pop("enrollment_url", None)
        return data

    def transform_schema(self, schema, direction):
        """Remove enrollment_url from schema for older versions."""
        if direction == "backwards":
            schema.get("properties", {}).pop("enrollment_url", None)
            required = schema.get("required", [])
            if "enrollment_url" in required:
                required.remove("enrollment_url")
        return schema


class VideoAddThumbnailUrl(Transform):
    """v2 adds thumbnail_url to VideoSerializer."""

    version = "v2"
    description = "Add thumbnail_url field to Video"
    serializer = "learning_resources.serializers.VideoSerializer"

    def to_representation(self, data, request, instance):  # noqa: ARG002
        """Remove thumbnail_url for v1 clients."""
        data.pop("thumbnail_url", None)
        return data

    def transform_schema(self, schema, direction):
        """Remove thumbnail_url from schema for older versions."""
        if direction == "backwards":
            schema.get("properties", {}).pop("thumbnail_url", None)
            required = schema.get("required", [])
            if "thumbnail_url" in required:
                required.remove("thumbnail_url")
        return schema


class VideoRemoveCoverImageUrl(Transform):
    """v2 removes cover_image_url from VideoSerializer."""

    version = "v2"
    description = "Remove cover_image_url field from Video"
    serializer = "learning_resources.serializers.VideoSerializer"

    def to_representation(self, data, request, instance):  # noqa: ARG002
        """Restore cover_image_url for v1 clients."""
        if "cover_image_url" not in data:
            if instance is not None:
                data["cover_image_url"] = getattr(instance, "cover_image_url", "")
            else:
                data["cover_image_url"] = ""
        return data

    def transform_schema(self, schema, direction):
        """Add cover_image_url back to schema for older versions."""
        if direction == "backwards":
            props = schema.get("properties", {})
            props["cover_image_url"] = {
                "type": "string",
                "format": "uri",
                "nullable": True,
                "readOnly": True,
            }
        return schema


class CaptionUrlAddWordCount(Transform):
    """v2 adds word_count to CaptionUrlSerializer entries in VideoSerializer."""

    version = "v2"
    description = "Add word_count to caption URL entries"
    serializer = "learning_resources.serializers.VideoSerializer"

    def to_representation(self, data, request, instance):  # noqa: ARG002
        """Strip word_count from each caption entry for v1 clients."""
        if "caption_urls" in data and isinstance(data["caption_urls"], list):
            for caption in data["caption_urls"]:
                if isinstance(caption, dict):
                    caption.pop("word_count", None)
        return data

    def transform_schema(self, schema, direction):
        """Remove word_count from CaptionUrl items schema for older versions."""
        if direction == "backwards":
            caption_schema = (
                schema.get("properties", {}).get("caption_urls", {}).get("items", {})
            )
            if caption_schema:
                caption_schema.get("properties", {}).pop("word_count", None)
                required = caption_schema.get("required", [])
                if "word_count" in required:
                    required.remove("word_count")
        return schema
