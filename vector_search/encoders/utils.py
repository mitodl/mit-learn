from django.conf import settings
from django.utils.module_loading import import_string


def dense_encoder():
    Encoder = import_string(settings.QDRANT_ENCODER)
    return Encoder(model_name=settings.QDRANT_DENSE_MODEL)


def dense_model_short_name():
    split_name = settings.QDRANT_DENSE_MODEL.split("/")
    if len(split_name) > 0:
        return split_name[1]
    return settings.QDRANT_DENSE_MODEL
