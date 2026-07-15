"""Models for content_feedback."""

from django.conf import settings
from django.db import models

from content_feedback.constants import ContentFeedbackSentiment
from main.models import TimestampedModel


class ContentFeedback(TimestampedModel):
    """
    Learner feedback on a specific piece of course content (a leaf block).

    Append-only: every submission is kept as its own date-stamped record (via
    ``TimestampedModel.created_on``), so the full history is preserved. A learner
    may submit on the same block more than once; "latest reaction wins" is a
    read-time/data-platform concern (take the most recent by ``created_on``),
    not enforced here. The data is write-only from the learner's perspective -
    it is not read back into the courseware UI.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="content_feedback",
    )
    course_id = models.CharField(max_length=255)
    course_name = models.CharField(max_length=255, blank=True)
    block_usage_key = models.CharField(max_length=255, db_index=True)
    block_type = models.CharField(max_length=64, blank=True)
    block_display_name = models.CharField(max_length=255, blank=True)
    unit_title = models.CharField(max_length=255, blank=True)
    url = models.TextField(blank=True)
    sentiment = models.CharField(
        max_length=10,
        choices=((member.name, member.value) for member in ContentFeedbackSentiment),
    )
    comment = models.TextField(blank=True)

    class Meta:
        """Meta options for ContentFeedback."""

        indexes = [
            models.Index(
                fields=["course_id", "created_on"],
                name="content_fb_course_time_idx",
            ),
        ]

    def __str__(self):
        """Return a readable representation of the feedback record."""
        return f"{self.block_usage_key}-{self.sentiment}"
