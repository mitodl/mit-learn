"""URL configurations for authentication"""

from django.urls import re_path

from authentication.views import CustomLoginView, CustomLogoutView, NextLogoutView

urlpatterns = [
    re_path(r"^logout", CustomLogoutView.as_view(), name="logout"),
    re_path(r"^next_logout", NextLogoutView.as_view(), name="next_logout"),
    re_path(r"^login", CustomLoginView.as_view(), name="login"),
]
