from rest_framework.pagination import LimitOffsetPagination


class DefaultPagination(LimitOffsetPagination):
    """
    Default pagination class for rest APIs
    """

    count_fields = ("pk",)

    default_limit = 10
    max_limit = 100

    def get_count(self, queryset):
        """Get the count of objects in the queryset"""
        # we additionally filter this down to a subset of fields
        return queryset.only(*self.count_fields).count()


class LargePagination(DefaultPagination):
    """Large pagination for small resources, e.g., topics."""

    default_limit = 1000
    max_limit = 1000
