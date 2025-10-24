"""URLs for video_shorts"""

from django.urls import include, re_path
from rest_framework.routers import SimpleRouter

from video_shorts import views

router = SimpleRouter()
router.register(
    r"video_shorts",
    views.VideoShortViewSet,
    basename="video_shorts_api",
)


v0_urls = [
    *router.urls,
]

app_name = "video_shorts"
urlpatterns = [
    re_path(r"^api/v0/", include((v0_urls, "v0"))),
]
