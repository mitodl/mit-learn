"""Models for news_events"""

from django.contrib.postgres.fields import ArrayField
from django.db import models

from main.models import TimestampedModel
from news_events.constants import FeedType


class FeedImage(TimestampedModel):
    """Represent image metadata for a feed source or item"""

    url = models.TextField(max_length=2048, blank=True)
    description = models.CharField(max_length=1024, blank=True)
    alt = models.CharField(max_length=1024, blank=True)

    def __str__(self):
        return self.url


class FeedSource(TimestampedModel):
    """Represent a feed source for news or events."""

    title = models.CharField(max_length=255)
    url = models.URLField()
    description = models.TextField(blank=True)
    feed_type = models.CharField(
        max_length=255,
        choices=((member.name, member.value) for member in FeedType),
    )
    image = models.ForeignKey(FeedImage, on_delete=models.SET_NULL, null=True)

    def __str__(self):
        return f"{self.title} - {self.url}"


class FeedTopic(TimestampedModel):
    """Represent a topic for a feed item"""

    code = models.CharField(max_length=128)
    name = models.CharField(max_length=255)
    url = models.URLField(blank=True)

    def __str__(self):
        return self.name


class FeedItem(TimestampedModel):
    """Represent a news/event item from a feed source."""

    guid = models.CharField(max_length=128, unique=True)
    source = models.ForeignKey(
        FeedSource, on_delete=models.CASCADE, related_name="feed_items"
    )
    title = models.CharField(max_length=255)
    url = models.URLField()
    summary = models.TextField(blank=True)
    content = models.TextField(blank=True)
    item_date = models.DateTimeField()
    topics = models.ManyToManyField(FeedTopic, blank=True)
    image = models.ForeignKey(FeedImage, on_delete=models.SET_NULL, null=True)

    prefetches = [
        "topics",
    ]

    related_selects = ["source", "image", "news_details", "event_details"]

    def __str__(self):
        return f"{self.title} - {self.url}"

    class Meta:
        ordering = ["-item_date"]


class FeedEventDetail(TimestampedModel):
    """Represent event details for a feed item."""

    feed_item = models.OneToOneField(
        FeedItem, on_delete=models.CASCADE, related_name="event_details"
    )
    audience = ArrayField(models.CharField(max_length=255, blank=True))
    location = ArrayField(models.CharField(max_length=255, blank=True))
    event_type = ArrayField(models.CharField(max_length=255, blank=True))


class FeedNewsDetail(TimestampedModel):
    """Represent news details for a feed item."""

    feed_item = models.OneToOneField(
        FeedItem, on_delete=models.CASCADE, related_name="news_details"
    )
    authors = ArrayField(models.CharField(max_length=255), blank=True)
