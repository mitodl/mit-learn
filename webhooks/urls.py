from django.urls import re_path

from webhooks.views import ContentFileWebhookView

urlpatterns = [
    re_path(
        r"^content_files/",
        ContentFileWebhookView.as_view(),
        name="content_file_webhook",
    ),
]
