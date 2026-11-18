"""Filters for website_content API"""

from django_filters import ChoiceFilter, FilterSet

from website_content.constants import WebsiteContentStatus, WebsiteContentType
from website_content.models import WebsiteContent


class WebsiteContentFilter(FilterSet):
    """FilterSet for WebsiteContent."""

    content_type = ChoiceFilter(
        label="Filter by content type",
        choices=WebsiteContentType.as_tuple(),
    )
    status = ChoiceFilter(
        label=(
            "Filter by publish status. Defaults to published. Drafts are only"
            " returned to users who may edit website content; for anyone else,"
            " draft is always empty and both is the same as published."
        ),
        choices=WebsiteContentStatus.as_tuple(),
        method="filter_status",
    )

    def __init__(self, data=None, *args, **kwargs):
        # Published unless the caller asks otherwise, so nobody is handed
        # drafts without asking for them.
        data = data.copy() if data is not None else {}
        if not data.get("status"):
            data["status"] = WebsiteContentStatus.published.name
        super().__init__(data, *args, **kwargs)

    def filter_status(self, queryset, name, value):  # noqa: ARG002
        if value == WebsiteContentStatus.published.name:
            return queryset.filter(is_published=True)
        if value == WebsiteContentStatus.draft.name:
            return queryset.filter(is_published=False)
        return queryset

    class Meta:
        model = WebsiteContent
        fields = ["content_type", "status"]
