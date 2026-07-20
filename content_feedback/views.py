"""Views for content_feedback."""

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.generics import CreateAPIView
from rest_framework.permissions import IsAuthenticated

from content_feedback.models import ContentFeedback
from content_feedback.serializers import ContentFeedbackSerializer


@extend_schema(
    request=ContentFeedbackSerializer,
    responses={
        201: ContentFeedbackSerializer,
        400: OpenApiResponse(description="Invalid feedback submission"),
    },
)
class ContentFeedbackView(CreateAPIView):
    """Accept per-block content feedback submissions (append-only)."""

    queryset = ContentFeedback.objects.all()
    serializer_class = ContentFeedbackSerializer
    permission_classes = (IsAuthenticated,)

    def perform_create(self, serializer):
        """Attribute the feedback to the authenticated user (server-side)."""
        serializer.save(user=self.request.user)
