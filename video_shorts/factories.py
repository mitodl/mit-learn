"""Factories for video_shorts tests"""

from datetime import UTC, datetime, timedelta

import factory
from factory.django import DjangoModelFactory
from factory.fuzzy import FuzzyDateTime

from video_shorts.models import VideoShort


class VideoShortFactory(DjangoModelFactory):
    """Factory for VideoShort model"""

    video_id = factory.Sequence(lambda n: f"test_vid_{n:03d}")
    title = factory.Faker("sentence", nb_words=5)
    published_at = FuzzyDateTime(
        datetime.now(tz=UTC) - timedelta(days=365),
        datetime.now(tz=UTC),
    )
    thumbnail_small_url = factory.LazyAttribute(
        lambda obj: f"/shorts/{obj.video_id}/{obj.video_id}_small.jpg"
    )
    thumbnail_large_url = factory.LazyAttribute(
        lambda obj: f"/shorts/{obj.video_id}/{obj.video_id}_large.jpg"
    )
    video_url = factory.LazyAttribute(
        lambda obj: f"/shorts/{obj.video_id}/{obj.video_id}.mp4"
    )

    class Meta:
        model = VideoShort
