"""URL configurations for HubSpot proxy endpoints."""

from django.urls import re_path

from ol_hubspot.views import hubspot_form_detail_view, hubspot_forms_list_view

urlpatterns = [
    re_path(
        r"^api/v1/hubspot/forms/$",
        hubspot_forms_list_view,
        name="hubspot-forms-list",
    ),
    re_path(
        r"^api/v1/hubspot/forms/(?P<form_id>[^/]+)/$",
        hubspot_form_detail_view,
        name="hubspot-forms-detail",
    ),
]
