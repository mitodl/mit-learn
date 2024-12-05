from django.urls import include, path, re_path
from rest_framework.routers import SimpleRouter

from vector_search.views import LearningResourcesVectorSearchView

router = SimpleRouter()
v0_urls = [
    path(
        r"learning_resources_vector_search/",
        LearningResourcesVectorSearchView.as_view(),
        name="learning_resources_vector_search",
    ),
]

app_name = "vector_search"
urlpatterns = [
    re_path(r"^api/v0/", include((v0_urls, "v0"))),
]
