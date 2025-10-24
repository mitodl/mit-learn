"""Serializers for video shorts"""

from django.conf import settings
from rest_framework import serializers

from video_shorts.models import VideoShort


class YouTubeThumbnailSerializer(serializers.Serializer):
    """Serializer for individual thumbnail data"""

    url = serializers.URLField()
    width = serializers.IntegerField()
    height = serializers.IntegerField()


class YouTubeThumbnailsSerializer(serializers.Serializer):
    """Serializer for thumbnails object containing multiple resolutions"""

    default = YouTubeThumbnailSerializer(required=False)
    medium = YouTubeThumbnailSerializer(required=False)
    high = YouTubeThumbnailSerializer(required=False)
    standard = YouTubeThumbnailSerializer(required=False)
    maxres = YouTubeThumbnailSerializer(required=False)


class YouTubeSnippetSerializer(serializers.Serializer):
    """Serializer for video snippet data"""

    published_at = serializers.DateTimeField()
    channel_id = serializers.CharField(required=False)
    title = serializers.CharField()
    description = serializers.CharField(required=False)
    thumbnails = YouTubeThumbnailsSerializer()
    channel_title = serializers.CharField(required=False)
    category_id = serializers.CharField(required=False)
    live_broadcast_content = serializers.CharField(required=False)
    default_language = serializers.CharField(required=False)
    default_audio_language = serializers.CharField(required=False)
    localized = serializers.DictField(required=False)

    def to_internal_value(self, data):
        """Convert camelCase field names from YouTube API to snake_case"""
        data = data.copy()
        transformed_data = {
            "published_at": data.pop("publishedAt", None),
            "channel_id": data.pop("channelId", None),
            "channel_title": data.pop("channelTitle", None),
            "category_id": data.pop("categoryId", None),
            "live_broadcast_content": data.pop("liveBroadcastContent", None),
            "default_language": data.pop("defaultLanguage", None),
            "default_audio_language": data.pop("defaultAudioLanguage", None),
            **data,
        }
        return super().to_internal_value(transformed_data)


class YouTubeContentDetailsSerializer(serializers.Serializer):
    """Serializer for video content details"""

    duration = serializers.CharField()
    dimension = serializers.CharField()
    definition = serializers.CharField()
    caption = serializers.CharField()
    licensed_content = serializers.BooleanField()
    content_rating = serializers.DictField()
    projection = serializers.CharField()

    def to_internal_value(self, data):
        """Convert camelCase field names from YouTube API to snake_case"""
        data = data.copy()
        transformed_data = {
            "licensed_content": data.pop("licensedContent", None),
            "content_rating": data.pop("contentRating", None),
            **data,
        }
        return super().to_internal_value(transformed_data)


class YouTubeMetadataSerializer(serializers.Serializer):
    """
    Serializer for Youtube API metadata for a single video.
    """

    kind = serializers.CharField()
    etag = serializers.CharField()
    id = serializers.CharField()
    snippet = YouTubeSnippetSerializer()
    content_details = YouTubeContentDetailsSerializer(required=False)

    def to_internal_value(self, data):
        """Convert camelCase field names from YouTube API to snake_case"""
        # Don't mutate the original data - make a copy
        data = data.copy()
        transformed_data = {
            "content_details": data.pop("contentDetails", None),
            **data,
        }
        return super().to_internal_value(transformed_data)


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

    @staticmethod
    def transform_youtube_data(
        youtube_data, video_short: VideoShort = None
    ) -> "VideoShortSerializer":
        """
        Transform YouTube API v3 data into VideoShort model format.

        Args:
            youtube_data: Validated data from YouTubeVideoWebHookRequestSerializer
            video_short: Optional existing VideoShort instance to update

        Returns:
            dict: Data formatted for VideoShort model
        """
        snippet = youtube_data["snippet"]
        thumbnails = snippet["thumbnails"]

        # Choose the best available thumbnail resolution
        thumbnail_data = (
            thumbnails.get("high")
            or thumbnails.get("medium")
            or thumbnails.get("default")
        )

        youtube_id = youtube_data["id"]
        # Use relative URLs so they work regardless of domain
        base_path = f"/{settings.VIDEO_SHORTS_S3_PREFIX}/{youtube_id}/"

        return VideoShortSerializer(
            instance=video_short,
            data={
                "youtube_id": youtube_id,
                "title": snippet["title"],
                "description": snippet.get("description", ""),
                "published_at": snippet["published_at"],
                "thumbnail_height": thumbnail_data["height"],
                "thumbnail_width": thumbnail_data["width"],
                "video_url": f"{base_path}{youtube_id}.mp4",
                "thumbnail_url": f"{base_path}{youtube_id}.jpg",
            },
        )
