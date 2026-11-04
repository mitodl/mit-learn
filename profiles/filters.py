"""Profile/user filters"""

import django_filters
from django.contrib.auth import get_user_model

User = get_user_model()


class UserFilter(django_filters.FilterSet):
    """User filter"""

    email__endswith = django_filters.CharFilter(
        field_name="email", lookup_expr="iendswith"
    )

    class Meta:
        model = User
        fields = ("email__endswith",)
