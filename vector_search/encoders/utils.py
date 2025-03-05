from functools import cache

from django.conf import settings
from django.utils.module_loading import import_string


@cache
def dense_encoder():
    """
    Return the dense encoder based on settings
    """
    Encoder = import_string(settings.QDRANT_ENCODER)
    if settings.QDRANT_DENSE_MODEL:
        return Encoder(model_name=settings.QDRANT_DENSE_MODEL)
    return Encoder()
