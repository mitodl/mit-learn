"""Users URL configuration"""

from django.urls import re_path

from users.views import UnsubscribeView

app_name = "users"

urlpatterns = [
    re_path(
        r"^unsubscribe/(?P<token>[^/]+)/$",
        UnsubscribeView.as_view(),
        name="unsubscribe",
    ),
]
