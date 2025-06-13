from rest_framework import serializers

from learning_resources.etl.constants import ETLSource


class ContentFileWebHookRequestSerializer(serializers.Serializer):
    content_url = serializers.CharField()
    source_choices = [(e.name.lower(), e.value) for e in ETLSource]
    source = serializers.ChoiceField(choices=source_choices)
