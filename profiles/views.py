"""Views for REST APIs for channels"""

from cairosvg import svg2png  # pylint:disable=no-name-in-module
from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.http import HttpResponse, HttpResponseRedirect
from django.shortcuts import get_object_or_404, redirect
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.cache import cache_page
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from main.permissions import (
    AnonymousAccessReadonlyPermission,
    IsStaffPermission,
)
from profiles.models import Profile, ProgramCertificate, ProgramLetter, UserWebsite
from profiles.permissions import HasEditPermission, HasSiteEditPermission
from profiles.serializers import (
    ProfileSerializer,
    ProgramLetterSerializer,
    UserSerializer,
    UserWebsiteSerializer,
)
from profiles.utils import (
    DEFAULT_PROFILE_IMAGE,
    generate_svg_avatar,
)


@extend_schema(exclude=True)
class UserViewSet(viewsets.ModelViewSet):
    """View for users"""

    permission_classes = (IsAuthenticated, IsStaffPermission)

    serializer_class = UserSerializer

    queryset = get_user_model().objects.filter(is_active=True)
    lookup_field = "username"


class ProgramLetterViewSet(viewsets.ViewSet):
    """Detail only View for program letters"""

    authentication_classes = []
    permission_classes = []

    def retrieve(self, request, pk=None):  # noqa: ARG002
        queryset = ProgramLetter.objects.all()
        program_letter = get_object_or_404(queryset, pk=pk)
        serializer = ProgramLetterSerializer(program_letter)
        return Response(serializer.data)


class CurrentUserRetrieveViewSet(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """User retrieve and update viewsets for the current user"""

    serializer_class = UserSerializer
    permission_classes = (IsAuthenticated,)

    def get_object(self):
        """Return the current request user"""
        # NOTE: this may be a logged in or anonymous user
        return self.request.user


@extend_schema(exclude=True)
class ProfileViewSet(
    mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet
):
    """View for profile"""

    permission_classes = (AnonymousAccessReadonlyPermission, HasEditPermission)
    serializer_class = ProfileSerializer
    queryset = Profile.objects.prefetch_related("userwebsite_set").filter(
        user__is_active=True
    )
    lookup_field = "user__username"

    def get_serializer_context(self):
        return {"include_user_websites": True}


@extend_schema(exclude=True)
class UserWebsiteViewSet(
    mixins.CreateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet
):
    """View for user websites"""

    permission_classes = (IsAuthenticated, HasSiteEditPermission)
    serializer_class = UserWebsiteSerializer
    queryset = UserWebsite.objects.select_related("profile__user")


@cache_page(60 * 60 * 24)
def name_initials_avatar_view(
    request,  # noqa: ARG001
    username,
    size,
    color,
    bgcolor,
):  # pylint:disable=unused-argument
    """View for initial avatar"""
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
        letter, created = ProgramLetter.objects.get_or_create(
            user=request.user, certificate=certificate
        )
        return HttpResponseRedirect(letter.get_absolute_url())
