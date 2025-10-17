"""URL configurations for authentication"""

from django.urls import re_path

from authentication.views import CustomLoginView, CustomLogoutView, lti_auth, lti_login

urlpatterns = [
    re_path(r"^logout", CustomLogoutView.as_view(), name="logout"),
    re_path(r"^login", CustomLoginView.as_view(), name="login"),
    re_path(r"^lti_login", lti_login, name="lti_login"),
    re_path(r"^lti_auth", lti_auth, name="lti_auth"),
]
