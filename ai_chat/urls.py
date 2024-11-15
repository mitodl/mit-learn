from django.urls import include, re_path

from ai_chat import views

v0_urls = [re_path(r"^chat", views.ChatbotView.as_view(), name="chatbot_api")]
urlpatterns = [re_path(r"^api/v0/", include((v0_urls, "v0")))]
