from rest_framework import serializers

from learning_resources.etl.constants import ETLSource


class ContentFileWebHookRequestSerializer(serializers.Serializer):
    """
    Serializer for ContentFile webhook requests.
    """

    content_url = serializers.CharField()
    source_choices = [(e.name.lower(), e.value) for e in ETLSource]
    source = serializers.ChoiceField(choices=source_choices)


class WebhookResponseSerializer(serializers.Serializer):
    """
    Serializer for webhook responses.
    """

    status = serializers.CharField()
    message = serializers.CharField(required=False, allow_blank=True)
    error = serializers.CharField(required=False, allow_blank=True)
