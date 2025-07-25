from django.urls import include, re_path
from rest_framework.routers import SimpleRouter

from webhooks.views import ContentFileWebhookView

router = SimpleRouter()

v1_urls = [
    re_path(
        r"^content_files/",
        ContentFileWebhookView.as_view(),
        name="content_file_webhook",
    ),
]

urlpatterns = [
    re_path(r"^api/v1/webhooks/", include((v1_urls, "v1"))),
]
