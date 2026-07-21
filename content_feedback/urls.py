"""URL config for content_feedback."""

from django.urls import include, re_path

from content_feedback.views import ContentFeedbackView

v0_urls = [
    re_path(
        r"^content_feedback/$",
        ContentFeedbackView.as_view(),
        name="content_feedback",
    ),
]

app_name = "content_feedback"
urlpatterns = [
    re_path("^api/v0/", include((v0_urls, "v0"))),
]
