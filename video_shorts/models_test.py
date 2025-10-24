"""Tests for video_shorts.models"""

import pytest
from django.db import IntegrityError

from video_shorts.factories import VideoShortFactory

pytestmark = [pytest.mark.django_db]


def test_video_short_unique_youtube_id():
    """Test that youtube_id must be unique"""
    VideoShortFactory.create(youtube_id="duplicate_id")

    with pytest.raises(IntegrityError):
        VideoShortFactory.create(youtube_id="duplicate_id")
