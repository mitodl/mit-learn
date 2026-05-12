from rest_framework.permissions import SAFE_METHODS, BasePermission

from learning_resources.permissions import is_admin_user
from website_content.constants import GROUP_STAFF_ARTICLE_EDITORS


def is_website_content_editor(request):
    """
    Return True if the request user belongs to the article_editors group or
    is an admin.

    Args:
        request (HTTPRequest): django request object

    Returns:
        bool: True if user is a content editor or admin
    """
    return (
        request.user is not None
        and request.user.groups.filter(name=GROUP_STAFF_ARTICLE_EDITORS).first()
        is not None
    )


class CanViewWebsiteContent(BasePermission):
    """
    Allow viewing a content item if:
    - user is admin/content editor, OR
    - the item is published
    """

    def has_object_permission(self, request, _, obj):
        if is_admin_user(request) or is_website_content_editor(request):
            return True
        return obj.is_published


class CanEditWebsiteContent(BasePermission):
    def has_permission(self, request, _view):
        if request.method not in SAFE_METHODS:
            return is_admin_user(request) or is_website_content_editor(request)
        return True
