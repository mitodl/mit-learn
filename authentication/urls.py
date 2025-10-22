"""URL configurations for authentication"""

from django.urls import re_path

from authentication.views import (
    CustomLoginView,
    CustomLogoutView,
    lti_auth,
    lti_login,
    public_keyset,
)

urlpatterns = [
    re_path(r"^logout", CustomLogoutView.as_view(), name="logout"),
    re_path(r"^login", CustomLoginView.as_view(), name="login"),
    re_path(r"^lti_login", lti_login, name="lti_login"),
    re_path(r"^lti_auth", lti_auth, name="lti_auth"),
    re_path(r"^lti_jwks", public_keyset, name="lti_jwks"),
]
