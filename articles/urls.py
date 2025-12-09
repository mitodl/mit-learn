from django.urls import include, path, re_path
from rest_framework.routers import SimpleRouter

from articles import views
from .views import MediaUploadView, ArticleDetailByIdOrSlugAPIView

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
        include(
            (
                [
                    # Existing router URLs for the ViewSet
                    *v1_router.urls,
                    # Media upload endpoint
                    path(
                        "upload-media/",
                        MediaUploadView.as_view(),
                        name="api-media-upload",
                    ),
                    # New endpoint: retrieve article by ID or slug
                    path(
                        "articles/detail/<str:identifier>/",
                        ArticleDetailByIdOrSlugAPIView.as_view(),
                        name="article-detail-by-id-or-slug",
                    ),
                ],
                "v1",
            )
        ),
    ),
]
