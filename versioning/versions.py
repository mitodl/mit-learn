from drf_versioning.transforms import Transform
from drf_versioning.versions import Version

VERSION_V0 = Version("0")
VERSION_V1 = Version("1")
VERSION_V2 = Version("2")


class TransformWithSchema(Transform):
    """Extend the standard Transform class with a function
    for transforming the spectacular schema
    """

    @staticmethod
    def transform_api_schema(schema: dict) -> dict:
        """
        Transform the schema to match the previous version.
        """
        raise NotImplementedError
