"""Permissions for ai chat agents"""

from rest_framework import permissions


class SearchAgentPermissions(permissions.BasePermission):
    """Permissions for ai search service"""

    def has_permission(self, request, view):  # noqa: ARG002
        """Check if the user has permission"""
        return True  # features.is_enabled("recommendation-bot")
