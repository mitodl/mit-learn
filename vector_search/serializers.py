from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from learning_resources.serializers import LearningResourceSerializer
from learning_resources_search.serializers import (
    SearchResponseMetadata,
    SearchResponseSerializer,
)


class LearningResourcesVectorSearchRequestSerializer(serializers.Serializer):
    q = serializers.CharField(required=False, help_text="The search text")
    offset = serializers.IntegerField(
        required=False, help_text="The initial index from which to return the results"
    )
    limit = serializers.IntegerField(
        required=False, help_text="Number of results to return per page"
    )


class LearningResourcesVectorSearchResponseSerializer(SearchResponseSerializer):
    @extend_schema_field(LearningResourceSerializer(many=True))
    def get_results(self, instance):
        return instance.get("hits", {})

    def get_count(self, instance) -> int:
        return instance.get("total", {}).get("value")

    def get_metadata(self, _) -> SearchResponseMetadata:
        return {
            "aggregations": [],
            "suggest": [],
        }
