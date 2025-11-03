from django.urls import include, re_path
from rest_framework.routers import SimpleRouter

from webhooks import views

app_name = "webhooks"
router = SimpleRouter()

v1_urls = [
    re_path(
        r"^content_files/$",
        views.ContentFileWebhookView.as_view(),
        name="content_file_webhook",
    ),
    re_path(
        r"^content_files/delete/",
        views.ContentFileDeleteWebhookView.as_view(),
        name="content_file_delete_webhook",
    ),
    re_path(
        r"^video_shorts/$",
        views.VideoShortWebhookView.as_view(),
        name="video_short_webhook",
    ),
]

urlpatterns = [
    re_path(r"^api/v1/webhooks/", include((v1_urls, "v1"))),
]
