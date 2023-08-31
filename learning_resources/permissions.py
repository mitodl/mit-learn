"""
learning_resources permissions
"""
from django.http import HttpRequest
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import SAFE_METHODS, BasePermission

from learning_resources.constants import GROUP_STAFF_LISTS_EDITORS
from learning_resources.models import LearningPath
from open_discussions.permissions import is_admin_user, is_readonly
from open_discussions.settings import DRF_NESTED_PARENT_LOOKUP_PREFIX


def is_learning_path_editor(request: HttpRequest) -> bool:
    """
    Determine if a request user is a member of the staff list editors group.

    Args:
        request (HttpRequest): The request

    Returns:
        bool: True if request user is a staff list editor
    """
    return (
        request.user is not None
        and request.user.groups.filter(name=GROUP_STAFF_LISTS_EDITORS).first()
        is not None
    )


class HasLearningPathPermissions(BasePermission):
    """
    Permission to view/create/modify LearningPaths
    """

    def has_permission(self, request, view):  # noqa: ARG002
        return (
            is_readonly(request)
            or is_admin_user(request)
            or is_learning_path_editor(request)
        )

    def has_object_permission(self, request, view, obj):  # noqa: ARG002
        can_edit = is_learning_path_editor(request) or is_admin_user(request)
        if request.method in SAFE_METHODS:
            return obj.published or can_edit
        return can_edit


class HasLearningPathItemPermissions(BasePermission):
    """Permission to view/create/modify LearningPathItems"""

    def has_permission(self, request, view):
        learning_path = get_object_or_404(
            LearningPath,
            learning_resource_id=view.kwargs.get(
                f"{DRF_NESTED_PARENT_LOOKUP_PREFIX}parent_id", None
            ),
        )
        can_edit = is_learning_path_editor(request) or is_admin_user(request)
        if request.method in SAFE_METHODS:
            return learning_path.learning_resource.published or can_edit
        return can_edit

    def has_object_permission(self, request, view, obj):  # noqa: ARG002
        can_edit = is_learning_path_editor(request) or is_admin_user(request)
        if request.method in SAFE_METHODS:
            return obj.parent.published or can_edit
        return can_edit
