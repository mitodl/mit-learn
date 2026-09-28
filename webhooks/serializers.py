import re

from rest_framework import serializers

from learning_resources.etl.constants import ETLSource
from learning_resources.etl.ovs import is_allowed_media_url

# OVS keys are opaque identifiers. Restrict them to characters that cannot alter
# the structure of any url or index path they get interpolated into.
OVS_KEY_REGEX = r"^[A-Za-z0-9._-]{1,255}$"


class ContentFileWebHookRequestSerializer(serializers.Serializer):
    """
    Serializer for ContentFile webhook requests.
    """

    content_path = serializers.CharField(required=False, allow_blank=True)
    source_choices = [(e.name.lower(), e.value) for e in ETLSource]
    source = serializers.ChoiceField(choices=source_choices)
    course_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    course_readable_id = serializers.CharField(
        required=False, allow_blank=True, allow_null=True
    )


class OVSVideoWebhookRequestSerializer(serializers.Serializer):
    """
    Serializer for OVS video webhook requests.

    Accepts either an OVS video upsert payload (full result dict from the OVS
    public videos API; `key` is required) or a delete payload (`video_id` plus
    `delete: true`).
    """

    key = serializers.RegexField(OVS_KEY_REGEX, required=False)
    video_id = serializers.RegexField(OVS_KEY_REGEX, required=False)
    delete = serializers.BooleanField(required=False, default=False)

    def _nested_objects(self, field):
        """
        Return the nested list of objects at `field`, requiring the right shape.

        The loader iterates these lists, so a payload of the wrong shape has to
        be refused here rather than blowing up downstream.
        """
        items = self.initial_data.get(field)
        if items is None:
            return []
        if not isinstance(items, list) or any(
            not isinstance(item, dict) for item in items
        ):
            raise serializers.ValidationError(
                {field: f"{field} must be a list of objects"}
            )
        return items

    def _validate_media_urls(self):
        """
        Reject upsert payloads carrying urls outside the OVS media allowlist.

        The payload is attacker-controlled input, and its urls are fetched
        server-side (subtitles) or served to browsers (thumbnails, streams), so
        an unrecognized host is refused rather than silently dropped.
        """
        candidates = [
            ("cta_link", self.initial_data.get("cta_link")),
            *[("sources", src.get("src")) for src in self._nested_objects("sources")],
            *[
                ("videothumbnail_set", thumbnail.get("cloudfront_url"))
                for thumbnail in self._nested_objects("videothumbnail_set")
            ],
        ]
        # subtitle urls are built from an allowlisted domain rather than taken
        # from the payload, but the list still has to have the expected shape
        self._nested_objects("videosubtitle_set")
        errors = {
            field: f"url is not on an allowed OVS media host: {url}"
            for field, url in candidates
            if url and not is_allowed_media_url(url)
        }
        if errors:
            raise serializers.ValidationError(errors)

    def _validate_collection(self):
        """Validate the nested collection key, which becomes a playlist id"""
        collection = self.initial_data.get("collection") or {}
        if not isinstance(collection, dict):
            raise serializers.ValidationError(
                {"collection": "collection must be an object"}
            )
        key = collection.get("key")
        if key and not re.match(OVS_KEY_REGEX, str(key)):
            raise serializers.ValidationError(
                {"collection": "collection key contains invalid characters"}
            )

    def validate(self, attrs):
        if attrs.get("delete"):
            if not attrs.get("video_id"):
                raise serializers.ValidationError(
                    {"video_id": "video_id is required for delete"}
                )
        elif not self.initial_data.get("key"):
            raise serializers.ValidationError({"key": "key is required for upsert"})
        else:
            self._validate_media_urls()
            self._validate_collection()
        return attrs


class WebhookResponseSerializer(serializers.Serializer):
    """
    Serializer for webhook responses.
    """

    status = serializers.CharField()
    message = serializers.CharField(required=False, allow_blank=True)
    error = serializers.CharField(required=False, allow_blank=True)


class ContentFileWebhookRequestSerializer(serializers.Serializer):
    """
    Serializer for ContentFile webhook requests.
    """

    bucket = serializers.CharField()
    key = serializers.CharField()
    source = serializers.CharField(required=False, allow_blank=True)
    run = serializers.CharField(required=False, allow_blank=True)
    course = serializers.CharField(required=False, allow_blank=True)
