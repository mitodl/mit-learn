import importlib.util

from django.conf import settings
from drf_versioning.serializers.utils import import_transforms
from drf_versioning.versions import Version

from versioning.version_list import VERSIONS


def api_versioning_hook(result, generator, request, public):  # noqa: ARG001
    """
    Find and apply all schema transforms for the current API version after
    drf-spectacular has generated the schema.
    """
    latest = Version.get_latest()
    version = result["info"]["version"]

    transform_classes = []
    for app in settings.INSTALLED_APPS:
        app_transforms_module = f"{app}.transforms"
        if importlib.util.find_spec(app_transforms_module):
            transform_classes.extend(import_transforms(app_transforms_module))
    if not transform_classes:
        return result

    # Iterate through all schema transforms from the latest to current api version
    while latest.base_version != version:
        version_transforms = [
            transform for transform in transform_classes if transform.version == latest
        ]
        for transform in version_transforms:
            result = transform.transform_api_schema(schema=result)
        latest = VERSIONS[
            next(iter([i - 1 for i, val in enumerate(VERSIONS) if val == latest]))
        ]
    return result
