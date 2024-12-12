"""Serializers for the ai_chat app"""

from django.conf import settings
from rest_framework import serializers


class ChatRequestSerializer(serializers.Serializer):
    """DRF serializer for chatbot requests"""

    message = serializers.CharField(allow_blank=False)
    model = serializers.CharField(default=settings.AI_MODEL, required=False)
    temperature = serializers.FloatField(min_value=0.0, max_value=1.0, required=False)
    instructions = serializers.CharField(required=False, allow_blank=True)
    clear_history = serializers.BooleanField(default=False)
