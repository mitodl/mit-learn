"""Urls for channels"""

from django.urls import include, re_path
from rest_framework.routers import DefaultRouter

from channels.views import (
    ChannelByTypeNameDetailView,
    ChannelCountsView,
    ChannelViewSet,
)

v0_router = DefaultRouter()
v0_router.register(r"channels", ChannelViewSet, basename="channels_api")

v0_urls = [
    re_path(
        r"^channels/type/(?P<channel_type>[A-Za-z0-9_\-]+)/(?P<name>[A-Za-z0-9_\-]+)/$",
        ChannelByTypeNameDetailView.as_view({"get": "retrieve"}),
        name="channel_by_type_name_api-detail",
    ),
    re_path(
        r"^channels/counts/(?P<channel_type>[A-Za-z0-9_\-]+)/$",
        ChannelCountsView.as_view({"get": "list"}),
        name="channel_counts_api-list",
    ),
    *v0_router.urls,
]

app_name = "channels"
urlpatterns = [
    re_path(r"^api/v0/", include((v0_urls, "v0"))),
]
