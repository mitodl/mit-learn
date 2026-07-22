"""Users views"""

from urllib.parse import urlencode

from django.conf import settings
from django.shortcuts import redirect
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from users.api import unsubscribe


class UnsubscribeView(APIView):
    """Handle email unsubscribe requests via signed token."""

    permission_classes = []
    authentication_classes = []

    @extend_schema(exclude=True)
    def get(self, request, token):  # noqa: ARG002
        params = urlencode({"token": token})
        return redirect(f"{settings.APP_BASE_URL}/unsubscribe?{params}")

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
        if not unsubscribe(token):
            return Response(
                {"error": "Invalid or expired token"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({}, status=status.HTTP_200_OK)
