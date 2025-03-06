from typing import Optional
from mitol.scim.filters import UserFilterQuery


class LearnUserFilterQuery(UserFilterQuery):
    """FilterQuery for User"""

    attr_map: dict[tuple[str, Optional[str]], tuple[str, ...]] = (
        UserFilterQuery.attr_map
        | {
            ("fullName", None): ("profile", "name"),
        }
    )

    related_selects = ["profile"]
