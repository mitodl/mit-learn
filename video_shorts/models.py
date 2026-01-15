"""Models for video shorts from Youtube"""

from django.db import models

from main.models import TimestampedModel


class VideoShort(TimestampedModel):
    """Model representing a video short"""

    video_id = models.CharField(max_length=20, primary_key=True)
    title = models.CharField(max_length=255)
    published_at = models.DateTimeField()
    # These are CharFields to allow storing just paths without domains
    thumbnail_large_url = models.CharField(blank=True)
    thumbnail_small_url = models.CharField(blank=True)
    video_url = models.CharField(blank=True)

    def __str__(self):
        return f"{self.title} ({self.video_id})"
