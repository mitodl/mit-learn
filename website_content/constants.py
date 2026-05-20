"""Constants for website_content app"""

from named_enum import ExtendedEnum

GROUP_WEBSITE_CONTENT_EDITORS = "website_content_editors"


class WebsiteContentType(ExtendedEnum):
    """
    Enum for WebsiteContent content_type values.
    """

    news = "News"
    article = "Article"
