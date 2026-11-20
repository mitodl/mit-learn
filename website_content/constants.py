"""Constants for website_content app"""

from named_enum import ExtendedEnum

GROUP_WEBSITE_CONTENT_EDITORS = "website_content_editors"


class WebsiteContentType(ExtendedEnum):
    """
    Enum for WebsiteContent content_type values.
    """

    news = "News"
    article = "Article"


class WebsiteContentStatus(ExtendedEnum):
    """
    Enum for the listing's `status` filter: which publish states to include.
    """

    published = "Published"
    draft = "Draft"
    both = "Both"
