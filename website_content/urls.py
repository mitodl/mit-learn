from django.urls import include, path, re_path
from rest_framework.routers import SimpleRouter

from website_content import views
from website_content.views import MediaUploadView

v1_router = SimpleRouter()
v1_router.register(
    r"website_content",
    views.WebsiteContentViewSet,
    basename="website_content",
)

# Backward-compatible alias: /api/v1/articles/ → same viewset
v1_articles_router = SimpleRouter()
v1_articles_router.register(
    r"articles",
    views.WebsiteContentViewSet,
    basename="articles",
)

app_name = "website_content"

urlpatterns = [
    re_path(
        r"^api/v1/",
        include(
            (
                [
                    *v1_router.urls,
                    *v1_articles_router.urls,
                    path(
                        "upload-media/",
                        MediaUploadView.as_view(),
                        name="api-media-upload",
                    ),
                ],
                "v1",
            )
        ),
    ),
]
