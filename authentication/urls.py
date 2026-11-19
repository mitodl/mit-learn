"""URL configurations for authentication"""

from django.urls import path, re_path

from authentication.views import (
    AccountActionCompleteView,
    AccountActionStartView,
    CustomLoginView,
    CustomLogoutView,
    PartnerLoginView,
)

urlpatterns = [
    re_path(r"^logout/?$", CustomLogoutView.as_view(), name="logout"),
    re_path(r"^login/?$", CustomLoginView.as_view(), name="login"),
    path(
        "account/action/start/<slug:action>/",
        AccountActionStartView.as_view(),
        name="account-action-start",
    ),
    # Outside the gateway's login paths (/login, /login/*), which would force a
    # normal login before this view runs.
    path(
        "partner-login/<slug:idp_alias>/",
        PartnerLoginView.as_view(),
        name="partner-login",
    ),
    path(
        "account/action/complete",
        AccountActionCompleteView.as_view(),
        name="account-action-complete",
    ),
]
