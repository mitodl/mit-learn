"""Common DRF serializers"""

from rest_framework import serializers

COMMON_IGNORED_FIELDS = ("created_on", "updated_on")


class _ReadOnlyReset(serializers.Field):
    """
    Internal class to reset read_only kwarg.

    We need to do this because a) we want it writeable and b) we need to inject
    between SerializerMethodField.__init__() and Field.__init__() because the
    later has mutually exclusive param validation that read_only factors into.

    This works python's MRO will call:
      - SerializerMethodField.__init__()
      - _ReadOnlyReset.__init__()
      - Field.__init__()
    """

    def __init__(self, **kwargs):
        kwargs.pop("read_only", None)
        super().__init__(**kwargs)


class WriteableSerializerMethodField(serializers.SerializerMethodField, _ReadOnlyReset):
    """
    A SerializerMethodField which has been marked as not read_only so that submitted data passed validation.
    """  # noqa: E501

    def to_internal_value(self, data):
        return data
