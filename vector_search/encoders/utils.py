from functools import lru_cache

from django.conf import settings
from django.utils.module_loading import import_string


@lru_cache(maxsize=1)
def dense_encoder():
    """
    Return the dense encoder based on settings
    """
    Encoder = import_string(settings.QDRANT_ENCODER)
    if settings.QDRANT_DENSE_MODEL:
        return Encoder(model_name=settings.QDRANT_DENSE_MODEL)
    return Encoder()
