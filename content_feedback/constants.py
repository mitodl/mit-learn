"""Constants for content_feedback"""

from named_enum import ExtendedEnum

COMMENT_MAX_LENGTH = 1000


class ContentFeedbackSentiment(ExtendedEnum):
    """
    Enum for per-block content feedback sentiment.

    Member names are the stored values (matching the MFE payload); the values
    are the human-readable labels used for the model field choices.
    """

    positive = "Positive"
    negative = "Negative"
    idea = "Idea"


# Django field choices: stored value is the member name (matches the MFE
# payload), label is the human-readable value. Referenced by the model field and
# by drf-spectacular's ENUM_NAME_OVERRIDES so the generated schema component is
# named ContentFeedbackSentimentEnum (not the generic SentimentEnum).
CONTENT_FEEDBACK_SENTIMENT_CHOICES = tuple(
    (member.name, member.value) for member in ContentFeedbackSentiment
)
