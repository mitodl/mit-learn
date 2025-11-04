from django_filters import BaseCSVFilter
from drf_spectacular.contrib.django_filters import DjangoFilterExtension


class CustomDjangoFilterExtension(DjangoFilterExtension):
    priority = DjangoFilterExtension.priority + 1

    def resolve_filter_field(self, *args, **kwargs):
        resolved = super().resolve_filter_field(*args, **kwargs)
        filter_field = args[4]
        if isinstance(filter_field, BaseCSVFilter):
            if len(resolved) != 1:
                msg = "Expected a single resolved field for BaseCSVFilter"
                raise ValueError(msg)
            resolved[0]["explode"] = True
        return resolved
