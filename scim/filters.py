from typing import Optional

from django_scim.filters import UserFilterQuery

from scim.parser.queries.sql import PatchedSQLQuery


class LearnUserFilterQuery(UserFilterQuery):
    """Filters for users"""

    query_class = PatchedSQLQuery

    attr_map: dict[tuple[Optional[str], Optional[str], Optional[str]], str] = {
        ("userName", None, None): "auth_user.username",
        ("emails", "value", None): "auth_user.email",
        ("active", None, None): "auth_user.is_active",
        ("fullName", None, None): "profiles_profile.name",
        ("name", "givenName", None): "auth_user.first_name",
        ("name", "familyName", None): "auth_user.last_name",
    }

    joins: tuple[str, ...] = (
        "INNER JOIN profiles_profile ON profiles_profile.user_id = auth_user.id",
    )

    @classmethod
    def search(cls, filter_query, request=None):
        return super().search(filter_query, request=request)
