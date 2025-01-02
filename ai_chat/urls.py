"""URLs for the ai_chat app."""

from django.urls import include, re_path

from ai_chat import views

app_name = "ai_chat"

v0_urls = [
    re_path(r"^chat_agent/", views.SearchAgentView.as_view(), name="chatbot_agent_api"),
]
urlpatterns = [
    re_path(r"^api/v0/", include((v0_urls, "v0"))),
]
