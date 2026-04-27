from django.urls import include, path, re_path
from rest_framework.routers import SimpleRouter

from vector_search.views import (
    ContentFilesVectorSearchView,
    LearningResourcesRecommendView,
    LearningResourcesVectorSearchView,
)

router = SimpleRouter()
v0_urls = [
    path(
        r"vector_learning_resources_search/",
        LearningResourcesVectorSearchView.as_view(),
        name="vector_learning_resources_search",
    ),
    path(
        r"vector_content_files_search/",
        ContentFilesVectorSearchView.as_view(),
        name="vector_content_files_search",
    ),
    path(
        r"recommend/",
        LearningResourcesRecommendView.as_view(),
        name="vector_learning_resources_recommend",
    ),
]

app_name = "vector_search"
urlpatterns = [
    re_path(r"^api/v0/", include((v0_urls, "v0"))),
]
