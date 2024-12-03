from django.conf import settings
from django.utils.module_loading import import_string


def dense_encoder():
    Encoder = import_string(settings.QDRANT_ENCODER)
    if settings.QDRANT_DENSE_MODEL:
        return Encoder(model_name=settings.QDRANT_DENSE_MODEL)
    return Encoder()
