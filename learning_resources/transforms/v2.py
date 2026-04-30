"""v2 transforms for learning_resources serializers.

These transforms maintain backwards compatibility for v1 clients when
the v2 API introduces breaking changes.

"""

from mitol.api_versioning.transforms import Transform


class DepartmentRenameChannelUrlToUrl(Transform):
    """v2 renames channel_url to url on LearningResourceBaseDepartmentSerializer."""

    version = "v2"
    description = "Rename channel_url to url on base Department"
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

    def transform_schema(self, schema):
        """Swap url/channel_url in schema and keep old ordering for v1."""
        props = schema.get("properties", {})
        if "url" in props:
            props["channel_url"] = props.pop("url")

        # Keep full Department property order stable in v0/v1 specs.
        if "channel_url" in props and "school" in props:
            ordered_keys = ["department_id", "name", "channel_url", "school"]
            new_props = {k: props[k] for k in ordered_keys if k in props}
            for key, value in props.items():
                if key not in new_props:
                    new_props[key] = value
            schema["properties"] = new_props

        required = schema.get("required", [])
        if "url" in required:
            required[required.index("url")] = "channel_url"
        required.sort()
        return schema


class FullDepartmentRenameChannelUrlToUrl(DepartmentRenameChannelUrlToUrl):
    """v2 renames channel_url to url on LearningResourceDepartmentSerializer.

    Needed because drf-spectacular emits a separate schema component for the
    full Department serializer even though the field is inherited, and the
    runtime transform lookup uses exact serializer-class matching.
    """

    version = "v2"
    description = "Rename channel_url to url on full Department"
    serializer = "learning_resources.serializers.LearningResourceDepartmentSerializer"


class RunAddEnrollmentUrl(Transform):
    """v2 adds enrollment_url to LearningResourceRunSerializer."""

    version = "v2"
    description = "Add enrollment_url field to Run"
    serializer = "learning_resources.serializers.LearningResourceRunSerializer"

    def to_representation(self, data, request, instance):  # noqa: ARG002
        """Remove enrollment_url for v1 clients."""
        data.pop("enrollment_url", None)
        return data

    def transform_schema(self, schema):
        """Remove enrollment_url from schema for older versions."""
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

    def transform_schema(self, schema):
        """Remove thumbnail_url from schema for older versions."""
        schema.get("properties", {}).pop("thumbnail_url", None)
        required = schema.get("required", [])
        if "thumbnail_url" in required:
            required.remove("thumbnail_url")
        return schema


class VideoRemoveCoverImageUrl(Transform):
    """v2 removes cover_image_url from VideoSerializer."""

    version = "v2"
    description = "Restore v1 cover_image_url property ordering on Video"
    serializer = "learning_resources.serializers.VideoSerializer"

    def to_representation(self, data, request, instance):  # noqa: ARG002
        """Restore cover_image_url for v1 clients."""
        if "cover_image_url" not in data:
            if "thumbnail_url" in data:
                data["cover_image_url"] = data["thumbnail_url"]
            elif instance is not None:
                data["cover_image_url"] = getattr(instance, "cover_image_url", "")
            else:
                data["cover_image_url"] = ""
        return data

    def transform_schema(self, schema):
        """Restore cover_image_url shape/order for older Video schemas."""
        props = schema.get("properties", {})
        required = schema.get("required", [])

        is_video_response = any(
            key in props for key in ("id", "caption_urls", "streaming_url")
        )
        if not is_video_response:
            # v1 request schemas did not include cover_image_url.
            props.pop("cover_image_url", None)
            if "cover_image_url" in required:
                required.remove("cover_image_url")
            return schema

        cover = {
            "type": "string",
            "format": "uri",
            "readOnly": True,
            "nullable": True,
        }

        # Force the legacy response shape for cover_image_url.
        props["cover_image_url"] = cover

        # Keep legacy property order: ... streaming_url, cover_image_url, duration.
        new_props = {}
        inserted = False
        for key, value in props.items():
            if key == "cover_image_url":
                continue
            if key == "duration" and not inserted:
                new_props["cover_image_url"] = cover
                inserted = True
            new_props[key] = value
        if not inserted:
            new_props["cover_image_url"] = cover
        schema["properties"] = new_props

        if "cover_image_url" not in required:
            if "duration" in required:
                required.insert(required.index("duration"), "cover_image_url")
            else:
                required.append("cover_image_url")
        return schema


class CourseAddCreditsEarned(Transform):
    """v2 adds credits_earned to CourseSerializer."""

    version = "v2"
    description = "Add credits_earned field to Course"
    serializer = "learning_resources.serializers.CourseSerializer"

    def to_representation(self, data, request, instance):  # noqa: ARG002
        """Remove credits_earned for v1 clients."""
        data.pop("credits_earned", None)
        return data

    def to_internal_value(self, data, request):  # noqa: ARG002
        """Drop credits_earned from v1 client requests."""
        data.pop("credits_earned", None)
        return data

    def transform_schema(self, schema):
        """Remove credits_earned from schema for older versions."""
        schema.get("properties", {}).pop("credits_earned", None)
        required = schema.get("required", [])
        if "credits_earned" in required:
            required.remove("credits_earned")
        return schema


class CaptionUrlAddWordCount(Transform):
    """v2 adds word_count to CaptionUrlSerializer entries in VideoSerializer."""

    version = "v2"
    description = "Add word_count to caption URL entries"
    serializer = "learning_resources.serializers.VideoSerializer"
    component_name = "CaptionUrl"

    def to_representation(self, data, request, instance):  # noqa: ARG002
        """Strip word_count from each caption entry for v1 clients."""
        if "caption_urls" in data and isinstance(data["caption_urls"], list):
            for caption in data["caption_urls"]:
                if isinstance(caption, dict):
                    caption.pop("word_count", None)
        return data

    def transform_schema(self, schema):
        """Remove word_count from the CaptionUrl component for older versions."""
        schema.get("properties", {}).pop("word_count", None)
        required = schema.get("required", [])
        if "word_count" in required:
            required.remove("word_count")
        return schema
