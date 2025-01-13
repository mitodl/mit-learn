"""Serializers for the ai_chat app"""

from django.conf import settings
from rest_framework import serializers

from ai_chat.constants import GROUP_STAFF_AI_SYTEM_PROMPT_EDITORS


class ChatRequestSerializer(serializers.Serializer):
    """DRF serializer for chatbot requests"""

    message = serializers.CharField(allow_blank=False)
    model = serializers.CharField(default=settings.AI_MODEL, required=False)
    temperature = serializers.FloatField(min_value=0.0, max_value=1.0, required=False)
    instructions = serializers.CharField(required=False)
    clear_history = serializers.BooleanField(default=False)

    def validate_instructions(self, value):
        """Check if the user is allowed to modify the AI system prompt"""
        if value:
            request = self.context.get("request")
            user = request.user
            if settings.ENVIRONMENT == "dev" or (
                user
                and user.is_authenticated
                and (
                    user.is_superuser
                    or user.groups.filter(
                        name=GROUP_STAFF_AI_SYTEM_PROMPT_EDITORS
                    ).first()
                    is not None
                )
            ):
                return value
            msg = "You are not allowed to modify the AI system prompt."
            raise serializers.ValidationError(msg)
        return value


class SyllabusChatRequestSerializer(ChatRequestSerializer):
    """DRF serializer for syllabus chatbot requests"""

    readable_id = serializers.CharField(required=True)
