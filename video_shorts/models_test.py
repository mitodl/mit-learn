"""Tests for video_shorts.models"""

import pytest
from django.db import IntegrityError

from video_shorts.factories import VideoShortFactory

pytestmark = [pytest.mark.django_db]


def test_video_short_unique_video_id():
    """Test that video_id must be unique"""
    VideoShortFactory.create(video_id="duplicate_id")

    with pytest.raises(IntegrityError):
        VideoShortFactory.create(video_id="duplicate_id")
