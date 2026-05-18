"""Constants for website_content app"""

from named_enum import ExtendedEnum

GROUP_STAFF_ARTICLE_EDITORS = "article_editors"


class WebsiteContentType(ExtendedEnum):
    """
    Enum for WebsiteContent content_type values.
    """

    news = "News"
    article = "Article"
