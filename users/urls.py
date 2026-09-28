"""Users URL configuration"""

from django.urls import include, re_path

from users.views import UnsubscribeView

app_name = "users"

v1_urls = [
    re_path(
        r"^unsubscribe/(?P<token>[^/]+)/$",
        UnsubscribeView.as_view(),
        name="unsubscribe",
    ),
]

urlpatterns = [
    re_path(r"^api/v1/", include((v1_urls, "v1"))),
]
