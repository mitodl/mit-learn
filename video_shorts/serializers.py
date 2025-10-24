"""Serializers for video shorts"""

from django.conf import settings
from rest_framework import serializers

from video_shorts.models import VideoShort


class VideoShortSerializer(serializers.ModelSerializer):
    """ModelSerializer for VideoShort model"""

    class Meta:
        model = VideoShort
        fields = [
            "youtube_id",
            "title",
            "description",
            "published_at",
            "thumbnail_url",
            "thumbnail_height",
            "thumbnail_width",
            "video_url",
            "created_on",
            "updated_on",
        ]
        read_only_fields = ["created_on", "updated_on"]


class YouTubeMetadataSerializer(VideoShortSerializer):
    """
    Serializer to transform Youtube API metadata to video short data.
    """

    def to_internal_value(self, data):
        """Convert YouTube API data to video short data format"""
        youtube_id = data.get("id")
        snippet = data.get("snippet", {})
        thumbnails = snippet.get("thumbnails", {})

        # Choose the best available thumbnail resolution
        thumbnail_data = (
            thumbnails.get("high")
            or thumbnails.get("medium")
            or thumbnails.get("default")
            or {}
        )

        # Use relative URLs so they work regardless of domain
        base_path = f"/{settings.VIDEO_SHORTS_S3_PREFIX}/{youtube_id}/"
        transformed_data = {
            "youtube_id": youtube_id,
            "title": snippet.get("title"),
            "description": snippet.get("description", ""),
            "published_at": snippet.get("publishedAt"),
            "thumbnail_height": thumbnail_data.get("height"),
            "thumbnail_width": thumbnail_data.get("width"),
            "video_url": f"{base_path}{youtube_id}.mp4",
            "thumbnail_url": f"{base_path}{youtube_id}.jpg",
        }
        return super().to_internal_value(transformed_data)
