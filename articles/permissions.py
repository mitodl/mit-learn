from django.http import HttpRequest
from articles.constants import GROUP_STAFF_ARTICLE_EDITORS
from rest_framework.permissions import SAFE_METHODS, BasePermission
from learning_resources.permissions import is_admin_user


def is_article_group_user(request):
    """
    Args:
        request (HTTPRequest): django request object

    Returns:
        bool: True if user is staff/admin
    """
    return (
        request.user is not None
        and request.user.groups.filter(name=GROUP_STAFF_ARTICLE_EDITORS).first()
        is not None
    )


class CanViewArticle(BasePermission):
    """
    Allow viewing an article if:
    - user is admin (article editor), OR
    - article is published
    """

    def has_object_permission(self, request, _, obj):
        # Editors (admins) may view any article
        if is_admin_user(request) or is_article_group_user(request):
            return True

        # Normal users may view ONLY published articles
        return obj.is_published


class CanEditArticle(BasePermission):
    def has_permission(self, request, _view):
        if request.method not in SAFE_METHODS:
            return is_admin_user(request) or is_article_group_user(request)
        return True
