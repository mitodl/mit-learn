"""URL configurations for HubSpot proxy endpoints."""

from django.urls import include, re_path

from ol_hubspot.views import (
    hubspot_form_detail_view,
    hubspot_form_submit_view,
    hubspot_forms_list_view,
)

v1_urls = [
    re_path(
        r"^hubspot/forms/$",
        hubspot_forms_list_view,
        name="hubspot-forms-list",
    ),
    re_path(
        r"^hubspot/forms/(?P<form_id>[^/]+)/$",
        hubspot_form_detail_view,
        name="hubspot-forms-detail",
    ),
    re_path(
        r"^hubspot/forms/(?P<form_id>[^/]+)/submit/$",
        hubspot_form_submit_view,
        name="hubspot-forms-submit",
    ),
]

app_name = "ol_hubspot"

urlpatterns = [
    re_path(r"^api/v1/", include((v1_urls, "v1"))),
]
