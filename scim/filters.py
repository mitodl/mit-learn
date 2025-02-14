import operator
from collections.abc import Callable
from typing import Optional

from django.db.models import Q
from django_scim.filters import UserFilterQuery

from scim.parser.grammar import FilterTermList


class LearnUserFilterQuery(UserFilterQuery):
    """Filters for users"""

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
    def _filter(cls, parsed) -> Q:
        if parsed is None:
            msg = "Expected a filter, got None"
            raise ValueError(msg)
        return Q()

    @classmethod
    def _filter_list(cls, parsed) -> Q:
        parsed_iter = iter(parsed)
        q = cls._term_to_django_q(next(parsed_iter))

        while operator := cls._operator(next(parsed_iter)):
            term = cls._term_to_q(next(parsed_iter))

            # combine the previous and next Q() objects using the bitwise operator
            q = operator(q, term)

        return q

    @classmethod
    def _operator(cls, parsed) -> Callable[[Q, Q], Q] | None:
        """Convert a defined operator to the corresponding bitwise operator"""
        if parsed is None:
            return None

        if parsed.operator.lower() == "and":
            return operator.and_
        elif parsed.operator.lower() == "or":
            return operator.or_
        else:
            msg = f"Unexpected operator: {parsed.operator}"
            raise ValueError(msg)

    @classmethod
    def search(cls, filter_query, request=None):  # noqa: ARG003
        """Create a search query"""
        parsed = FilterTermList.parse_string(filter_query, parse_all=True)

        return cls.model_cls().objects.filter(cls._filter(parsed))
