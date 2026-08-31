"""Views for REST APIs for channels"""

from cairosvg import svg2png  # pylint:disable=no-name-in-module
from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.db.models import Prefetch, QuerySet
from django.http import Http404, HttpResponse, HttpResponseRedirect
from django.shortcuts import get_object_or_404, redirect
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.cache import cache_page
from django.views.decorators.csrf import ensure_csrf_cookie
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from learning_resources.models import LearningResourceTopic
from main.permissions import (
    AnonymousAccessReadonlyPermission,
    IsStaffPermission,
)
from profiles.api import ensure_profile
from profiles.models import Profile, ProgramCertificate, ProgramLetter, UserWebsite
from profiles.permissions import HasEditPermission, HasSiteEditPermission
from profiles.serializers import (
    CurrentUserSerializer,
    ProfileSerializer,
    ProgramCertificateSerializer,
    ProgramLetterSerializer,
    UserSerializer,
    UserWebsiteSerializer,
)
from profiles.utils import (
    DEFAULT_PROFILE_IMAGE,
    generate_svg_avatar,
)


def profiles_for_serialization() -> QuerySet[Profile]:
    """Profiles with the relations ProfileSerializer reads."""
    return Profile.objects.prefetch_related(
        "userwebsite_set",
        Prefetch(
            "topic_interests",
            queryset=LearningResourceTopic.objects.for_serialization(),
            to_attr="annotated_topic_interests",
        ),
    )


class UserViewSet(viewsets.ModelViewSet):
    """View for users"""

    permission_classes = (IsAuthenticated, IsStaffPermission)
    pagination_class = None
    serializer_class = UserSerializer

    queryset = get_user_model().objects.filter(is_active=True)
    lookup_field = "username"


@method_decorator(ensure_csrf_cookie, name="retrieve")
class CurrentUserRetrieveViewSet(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """User retrieve and update viewsets for the current user"""

    serializer_class = CurrentUserSerializer
    permission_classes = (
        AnonymousAccessReadonlyPermission,
        HasEditPermission,
    )

    def get_object(self):
        """Return the current request user"""
        # NOTE: this may be a logged in or anonymous user
        return self.request.user


class ProfileViewSet(
    mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet
):
    """View for profile"""

    permission_classes = (AnonymousAccessReadonlyPermission, HasEditPermission)
    serializer_class = ProfileSerializer
    queryset = profiles_for_serialization().filter(user__is_active=True)
    lookup_field = "user__username"

    def get_object(self):
        """Get the profile"""

        if self.kwargs["user__username"] == "me":
            ensure_profile(self.request.user)
            # Fetched through the same queryset as the by-username route so the
            # prefetches apply; deliberately without its user__is_active filter,
            # which this branch has never applied.
            return get_object_or_404(
                profiles_for_serialization(), user=self.request.user
            )
        else:
            return super().get_object()

    def get_serializer_context(self):
        """Get the serializer context"""
        return {"include_user_websites": True}


class UserWebsiteViewSet(
    mixins.CreateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet
):
    """View for user websites"""

    permission_classes = (IsAuthenticated, HasSiteEditPermission)
    serializer_class = UserWebsiteSerializer
    queryset = UserWebsite.objects.select_related("profile__user")


class ProgramLetterViewSet(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Detail only View for program letters"""

    authentication_classes = []
    permission_classes = []
    serializer_class = ProgramLetterSerializer
    queryset = ProgramLetter.objects.all()

    def get_object(self) -> ProgramLetter:
        """
        Return the letter, 404ing if its certificate is gone.

        certificate is nullable and its column has no FK constraint, since
        ProgramCertificate is unmanaged, so the id can outlive the row. Every
        field of the response derives from the certificate, so there is nothing
        to render without it.
        """
        letter = super().get_object()
        try:
            certificate = letter.certificate
        except ProgramCertificate.DoesNotExist as exc:
            raise Http404 from exc
        if certificate is None:
            raise Http404
        return letter


class UserProgramCertificateViewSet(viewsets.ViewSet):
    """
    View for listing program certificates for a user
    (includes program letter links)
    """

    permission_classes = (IsAuthenticated,)
    serializer_class = ProgramCertificateSerializer
    filter_backends = (DjangoFilterBackend,)
    filterset_fields = ["micromasters_program_id", "program_title"]

    queryset = ProgramCertificate.objects.none()

    def list(self, request):
        queryset = ProgramCertificate.objects.filter(user_email=request.user.email)
        certificates = list(self.filter_queryset(queryset))
        letters = self.user_letters(request.user, certificates)
        for cert in certificates:
            cert.user_letter = letters[cert.pk]
        serializer = ProgramCertificateSerializer(
            certificates, many=True, context={"request": request}
        )
        return Response(serializer.data)

    @staticmethod
    def user_letters(user, certificates) -> dict:
        """
        Map certificate id to the user's ProgramLetter, creating any that don't
        exist yet.

        Serializing a certificate has always created its letter on demand; doing
        it here in bulk keeps that behaviour without a query per certificate.
        """
        letters = {
            letter.certificate_id: letter
            for letter in ProgramLetter.objects.filter(
                user=user, certificate__in=certificates
            )
        }
        missing = [cert for cert in certificates if cert.pk not in letters]
        if missing:
            letters.update(
                (letter.certificate_id, letter)
                for letter in ProgramLetter.objects.bulk_create(
                    ProgramLetter(user=user, certificate=cert) for cert in missing
                )
            )
        return letters

    def filter_queryset(self, queryset):
        for backend in list(self.filter_backends):
            queryset = backend().filter_queryset(self.request, queryset, view=self)
        return queryset


@cache_page(60 * 60 * 24)
def name_initials_avatar_view(
    request,  # noqa: ARG001
    username,
    size,
    color,
    bgcolor,
):  # pylint:disable=unused-argument
    """View for initial avatar"""
    User = get_user_model()

    user = User.objects.filter(username=username).first()
    if not user:
        return redirect(DEFAULT_PROFILE_IMAGE)
    svg = generate_svg_avatar(user.profile.name, int(size), color, bgcolor)
    return HttpResponse(svg2png(bytestring=svg), content_type="image/png")


@method_decorator(login_required, name="dispatch")
class ProgramLetterInterceptView(View):
    """
    View that generates a uuid (via ProgramLetter instance)
    and then passes the user along to the shareable letter view
    """

    def get(self, request, **kwargs):
        program_id = kwargs.get("program_id")
        certificate = get_object_or_404(
            ProgramCertificate,
            user_email=request.user.email,
            micromasters_program_id=program_id,
        )
        letter, _created = ProgramLetter.objects.get_or_create(
            user=request.user, certificate=certificate
        )
        return HttpResponseRedirect(letter.get_absolute_url())
