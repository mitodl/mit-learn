"""Permissions for ai chat agents"""

from rest_framework import permissions

from main import features


class SearchAgentPermissions(permissions.BasePermission):
    """Permissions for ai search service"""

    def has_permission(self, request, view):  # noqa: ARG002
        """Check if the user has permission"""
        return features.is_enabled("recommendation-bot")
