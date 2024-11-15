from rest_framework import serializers


class ChatRequestSerializer(serializers.Serializer):
    message = serializers.CharField()


class ChatResponseSerializer(serializers.Serializer):
    ai_response = serializers.CharField()
