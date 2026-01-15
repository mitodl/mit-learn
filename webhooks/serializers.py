from rest_framework import serializers

from learning_resources.etl.constants import ETLSource


class ContentFileWebHookRequestSerializer(serializers.Serializer):
    """
    Serializer for ContentFile webhook requests.
    """

    content_path = serializers.CharField(required=False, allow_blank=True)
    source_choices = [(e.name.lower(), e.value) for e in ETLSource]
    source = serializers.ChoiceField(choices=source_choices)
    course_id = serializers.CharField(required=False, allow_blank=True)
    course_readable_id = serializers.CharField(required=False, allow_blank=True)


class VideoShortWebhookRequestSerializer(serializers.Serializer):
    """
    Serializer for Video Short webhook requests.
    """

    video_id = serializers.CharField()
    video_metadata = serializers.DictField()
    source = serializers.CharField(required=False, allow_blank=True)


class WebhookResponseSerializer(serializers.Serializer):
    """
    Serializer for webhook responses.
    """

    status = serializers.CharField()
    message = serializers.CharField(required=False, allow_blank=True)
    error = serializers.CharField(required=False, allow_blank=True)


class ContentFileWebhookRequestSerializer(serializers.Serializer):
    """
    Serializer for ContentFile webhook requests.
    """

    bucket = serializers.CharField()
    key = serializers.CharField()
    source = serializers.CharField(required=False, allow_blank=True)
    run = serializers.CharField(required=False, allow_blank=True)
    course = serializers.CharField(required=False, allow_blank=True)
