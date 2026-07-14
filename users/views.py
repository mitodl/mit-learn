"""Users views"""

import logging
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import redirect
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from keycloak.exceptions import KeycloakError

from profiles.api import sync_email_optin_to_keycloak
from users.utils import unsign_unsubscribe_token

log = logging.getLogger(__name__)
User = get_user_model()


@method_decorator(csrf_exempt, name="dispatch")
class UnsubscribeView(View):
    """Handle email unsubscribe requests via signed token."""

    def _unsubscribe(self, token) -> bool:
        """Unsubscribe the user identified by token.

        Returns True on success, False if token is invalid/expired/unknown.
        """
        uuid_str = unsign_unsubscribe_token(token)
        if not uuid_str:
            return False
        user = User.objects.filter(unsubscribe_uuid=uuid_str).first()
        if not user:
            return False
        profile = user.profile
        try:
            with transaction.atomic():
                sync_email_optin_to_keycloak(user, email_optin=False)
                profile.email_optin = False
                profile.save(update_fields=["email_optin"])
        except KeycloakError:
            log.exception("Failed to sync email_optin to Keycloak for user %s", user.id)
            return False
        return True

    def get(self, request, token):  # noqa: ARG002
        if not self._unsubscribe(token):
            params = urlencode({"error_code": "invalid_token"})
            return redirect(f"{settings.APP_BASE_URL}/unsubscribed?{params}")
        return redirect(f"{settings.APP_BASE_URL}/unsubscribed")

    def post(self, request, token):  # noqa: ARG002
        if not self._unsubscribe(token):
            return JsonResponse({"error": "Invalid or expired token"}, status=400)
        return JsonResponse({}, status=200)
