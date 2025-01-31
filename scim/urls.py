"""URL configurations for profiles"""

from django.urls import include, re_path

from scim.views import BulkView

ol_scim_urls = (
    [
        re_path("^Bulk$", BulkView.as_view(), name="bulk"),
    ],
    "ol-scim",
)

urlpatterns = [
    re_path("^scim/v2/", include(ol_scim_urls)),
    re_path("^scim/v2/", include("django_scim.urls", namespace="scim")),
]
