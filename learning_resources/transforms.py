from versioning import versions
from versioning.versions import TransformWithSchema


class RenameLearningFormat(TransformWithSchema):
    version = versions.VERSION_V2
    description = "Renamed learning_format to delivery"

    def to_representation(self, data: dict, request, instance):  # noqa: ARG002
        """
        Downgrade the serializer's output data to make it match
        older API versions. In this case that means renaming the new
        'delivery' field to `learning_format`.
        """
        data["learning_format"] = data.pop("delivery", None)
        return data

    def to_internal_value(self, data: dict, request):  # noqa: ARG002
        """
        Upgrade the request.data to make it match the latest API version.
        In this case the 'delivery' field is read-only, so no action is required.
        """
        return data

    def schema_to_representation(self, schema: dict) -> dict:
        """
        Transform the response schema to match the previous version.
        """
        schema["properties"]["learning_format"] = schema["properties"].pop("delivery")
        return schema

    def schema_to_internal_value(self, schema: dict):
        """
        Transform the response schema to match the previous version.
        Delivery is read_only so it will never be in the request.
        """
        return schema
