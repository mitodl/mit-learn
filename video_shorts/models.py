"""Models for video shorts from Youtube"""

from django.db import models

from main.models import TimestampedModel


class VideoShort(TimestampedModel):
    """Model representing a video short from Youtube"""

    youtube_id = models.CharField(max_length=20, primary_key=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    published_at = models.DateTimeField()
    thumbnail_height = models.IntegerField()
    thumbnail_width = models.IntegerField()
    # These are CharFields to allow storing just paths without domains
    thumbnail_url = models.CharField()
    video_url = models.CharField()

    def __str__(self):
        return f"{self.title} ({self.youtube_id})"
