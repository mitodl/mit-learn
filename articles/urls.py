"""URL configuration for staff_content"""

from django.urls import include, re_path, path
from rest_framework.routers import SimpleRouter
from .views import MediaUploadView

from articles import views

v1_router = SimpleRouter()
v1_router.register(
    r"articles",
    views.ArticleViewSet,
    basename="articles",
)

app_name = "articles"
urlpatterns = [
    re_path(
        r"^api/v1/",
        include((
            [
                *v1_router.urls,
                path("upload-media/", MediaUploadView.as_view(), name="api-media-upload"),
            ],
            "v1",
        ))
    ),
]
