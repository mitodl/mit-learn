from rest_framework import serializers


class ChatRequestSerializer(serializers.Serializer):
    """DRF serializer for chatbot requests"""

    message = serializers.CharField(allow_blank=False)


class ChatResponseSerializer(serializers.Serializer):
    ai_response = serializers.CharField()
