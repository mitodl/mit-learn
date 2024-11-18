from django.urls import include, re_path

from ai_chat import views

app_name = "ai_chat"

v0_urls = [
    re_path(
        r"^chat_assistant",
        views.ChatbotAssistantView.as_view(),
        name="chatbot_assistant_api",
    ),
    re_path(r"^chat_agent", views.ChatbotAgentView.as_view(), name="chatbot_agent_api"),
]
urlpatterns = [
    re_path(r"^api/v0/", include((v0_urls, "v0"))),
]
