"""Filters for website_content API"""

from django_filters import BooleanFilter, ChoiceFilter, FilterSet

from website_content.constants import WebsiteContentType
from website_content.models import WebsiteContent


class WebsiteContentFilter(FilterSet):
    """FilterSet for WebsiteContent."""

    content_type = ChoiceFilter(
        label="Filter by content type",
        choices=WebsiteContentType.as_tuple(),
    )
    draft = BooleanFilter(
        label="Filter to show only draft (unpublished) items",
        method="filter_draft",
    )

    def filter_draft(self, queryset, name, value):  # noqa: ARG002
        if value:
            return queryset.filter(is_published=False)
        return queryset

    class Meta:
        model = WebsiteContent
        fields = ["content_type", "draft"]
