from versioning import versions
from versioning.versions import TransformWithSchema


class RenameDuration(TransformWithSchema):
    version = versions.VERSION_V2
    description = "Renamed learning_format to duration"

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

    @staticmethod
    def transform_api_schema(schema: dict) -> dict:
        """
        Transform the schema to match the previous version.
        """
        resource_components = [
            component
            for component in schema["components"]["schemas"]
            if component.endswith("Resource")
        ]
        for resource in resource_components:
            resource_schema = schema["components"]["schemas"][resource]
            if "delivery" in resource_schema.get("properties", {}):
                schema["components"]["schemas"][resource]["properties"][
                    "learning_format"
                ] = schema["components"]["schemas"][resource]["properties"].pop(
                    "delivery"
                )
        return schema
