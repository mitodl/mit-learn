"""Serializers for content_feedback."""

from rest_framework import serializers

from content_feedback.constants import COMMENT_MAX_LENGTH
from content_feedback.models import ContentFeedback


class ContentFeedbackSerializer(serializers.ModelSerializer):
    """
    Serializer for content feedback submissions.

    ``user`` is set server-side from the request (never client-supplied). Each
    valid submission is persisted as a new append-only record.
    """

    class Meta:
        """Meta options for ContentFeedbackSerializer."""

        model = ContentFeedback
        fields = [
            "course_id",
            "course_name",
            "block_usage_key",
            "block_type",
            "block_display_name",
            "unit_title",
            "url",
            "sentiment",
            "comment",
        ]
        extra_kwargs = {
            "course_id": {"required": True, "allow_blank": False},
            "block_usage_key": {"required": True, "allow_blank": False},
            "sentiment": {"required": True},
            "course_name": {"required": False, "allow_blank": True},
            "block_type": {"required": False, "allow_blank": True},
            "block_display_name": {"required": False, "allow_blank": True},
            "unit_title": {"required": False, "allow_blank": True},
            "url": {"required": False, "allow_blank": True},
            "comment": {"required": False, "allow_blank": True},
        }

    def validate_comment(self, value):
        """Truncate over-long comments rather than rejecting them."""
        if value and len(value) > COMMENT_MAX_LENGTH:
            return value[:COMMENT_MAX_LENGTH]
        return value
