"""Factories for video_shorts tests"""

from datetime import UTC, datetime, timedelta

import factory
from factory.django import DjangoModelFactory
from factory.fuzzy import FuzzyDateTime, FuzzyInteger

from video_shorts.models import VideoShort


class VideoShortFactory(DjangoModelFactory):
    """Factory for VideoShort model"""

    youtube_id = factory.Sequence(lambda n: f"test_vid_{n:03d}")
    title = factory.Faker("sentence", nb_words=5)
    description = factory.Faker("paragraph", nb_sentences=3)
    published_at = FuzzyDateTime(
        datetime.now(tz=UTC) - timedelta(days=365),
        datetime.now(tz=UTC),
    )
    thumbnail_url = factory.LazyAttribute(
        lambda obj: f"shorts/{obj.youtube_id}/{obj.youtube_id}.jpg"
    )
    thumbnail_height = FuzzyInteger(360, 720)
    thumbnail_width = FuzzyInteger(480, 1280)
    video_url = factory.LazyAttribute(
        lambda obj: f"shorts/{obj.youtube_id}/{obj.youtube_id}.mp4"
    )

    class Meta:
        model = VideoShort
