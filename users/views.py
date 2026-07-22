"""Users views"""

import logging
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import redirect
from drf_spectacular.utils import OpenApiResponse, extend_schema
from keycloak.exceptions import KeycloakError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from profiles.api import sync_email_optin_to_keycloak
from users.utils import unsign_unsubscribe_token

log = logging.getLogger(__name__)
User = get_user_model()


class UnsubscribeView(APIView):
    """Handle email unsubscribe requests via signed token."""

    permission_classes = []
    authentication_classes = []

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

    @extend_schema(exclude=True)
    def get(self, request, token):  # noqa: ARG002
        if not self._unsubscribe(token):
            params = urlencode({"error_code": "invalid_token"})
            return redirect(f"{settings.APP_BASE_URL}/unsubscribed?{params}")
        return redirect(f"{settings.APP_BASE_URL}/unsubscribed")

    @extend_schema(
        summary="One-click unsubscribe (RFC 8058)",
        request=None,
        responses={
            200: OpenApiResponse(
                response={"type": "object", "properties": {}},
                description="Successfully unsubscribed",
            ),
            400: OpenApiResponse(
                response={
                    "type": "object",
                    "properties": {"error": {"type": "string"}},
                },
                description="Invalid or expired token",
            ),
        },
    )
    def post(self, request, token):  # noqa: ARG002
        if not self._unsubscribe(token):
            return Response(
                {"error": "Invalid or expired token"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({}, status=status.HTTP_200_OK)
