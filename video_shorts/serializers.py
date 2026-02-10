"""Serializers for video shorts"""

from rest_framework import serializers

from video_shorts.models import VideoShort


class VideoShortSerializer(serializers.ModelSerializer):
    """ModelSerializer for VideoShort model"""

    class Meta:
        model = VideoShort
        fields = [
            "video_id",
            "title",
            "published_at",
            "thumbnail_small_url",
            "thumbnail_large_url",
            "video_url",
            "created_on",
            "updated_on",
        ]
        read_only_fields = ["created_on", "updated_on"]


class VideoShortWebhookSerializer(serializers.ModelSerializer):
    """
    Serializer to transform webhook metadata to VideoShort objects.
    """

    video_url = serializers.CharField()
    thumbnail_small_url = serializers.CharField()
    thumbnail_large_url = serializers.CharField()

    def to_internal_value(self, data):
        """Transform webhook data to internal representation"""
        data["thumbnail_small_url"] = data.pop("thumbnail_small", {}).get("url")
        data["thumbnail_large_url"] = data.pop("thumbnail_large", {}).get("url")
        return super().to_internal_value(data)

    class Meta:
        model = VideoShort
        fields = [
            "video_id",
            "title",
            "published_at",
            "thumbnail_small_url",
            "thumbnail_large_url",
            "video_url",
            "created_on",
            "updated_on",
        ]
        read_only_fields = ["created_on", "updated_on"]
