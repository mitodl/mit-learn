"""Views for content_feedback."""

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.generics import CreateAPIView
from rest_framework.permissions import AllowAny

from content_feedback.models import ContentFeedback
from content_feedback.serializers import ContentFeedbackSerializer
from main.throttles import RedisScopedRateThrottle


@extend_schema(
    request=ContentFeedbackSerializer,
    responses={
        201: ContentFeedbackSerializer,
        400: OpenApiResponse(description="Invalid feedback submission"),
        429: OpenApiResponse(description="Rate limit exceeded"),
    },
)
class ContentFeedbackView(CreateAPIView):
    """Accept per-block content feedback submissions (append-only).

    Anonymous submissions are allowed: courseware-only learners have no
    mit-learn/APISIX session, so requiring authentication would reject nearly
    all of them (403). This mirrors learn-ai/AskTIM, which tolerates anonymous
    callers and stores no user. Attributed submissions still record the user.
    """

    queryset = ContentFeedback.objects.all()
    serializer_class = ContentFeedbackSerializer
    permission_classes = (AllowAny,)
    throttle_classes = (RedisScopedRateThrottle,)
    throttle_scope = "content_feedback"

    def perform_create(self, serializer):
        """Attribute to the request user when authenticated, else store null."""
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(user=user)
