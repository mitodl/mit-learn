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
