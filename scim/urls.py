"""URL configurations for profiles"""

from django.urls import include, re_path
from scim.views import BulkView

app_name = "ol-scim"

urlpatterns = (
    re_path("^scim/v2/Bulk$", BulkView.as_view(), name="bulk"),
    re_path("^scim/v2/", include("django_scim.urls")),
)
