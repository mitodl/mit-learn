import logging
from functools import cache

import tiktoken
from django.conf import settings
from django.utils.module_loading import import_string
from litellm import get_model_info

logger = logging.getLogger(__name__)

DEFAULT_TRUNCATE_CHARS = 20_000


@cache
def dense_encoder():
    """
    Return the dense encoder based on settings
    """
    Encoder = import_string(settings.QDRANT_ENCODER)
    if settings.QDRANT_DENSE_MODEL:
        return Encoder(model_name=settings.QDRANT_DENSE_MODEL)
    return Encoder()


@cache
def sparse_encoder():
    """
    Return the sparse encoder based on settings
    """
    Encoder = import_string(settings.QDRANT_SPARSE_ENCODER)
    if settings.QDRANT_SPARSE_MODEL:
        return Encoder(model_name=settings.QDRANT_SPARSE_MODEL)
    return Encoder()


def truncate_to_model_limit(
    text: str,
    model: str,
    *,
    token_encoding_name: str | None = None,
) -> str:
    """
    Truncate text to the model's maximum input token limit if it can be
    determined. Otherwise fall back to a character limit.

    Args:
        text: Text to truncate.
        model: LiteLLM/OpenAI model name.
        token_encoding_name: Optional tiktoken encoding name. Required for
            token-based truncation.

    Returns:
        Truncated text.
    """
    max_input_tokens = None

    try:
        info = get_model_info(model)
        max_input_tokens = info.get("max_input_tokens")
    except Exception:
        logger.exception("Failed to determine max_input_tokens for model %s", model)

    if max_input_tokens and token_encoding_name:
        try:
            encoding = tiktoken.get_encoding(token_encoding_name)
            tokens = encoding.encode(text)

            if len(tokens) <= max_input_tokens:
                return text

            return encoding.decode(tokens[:max_input_tokens])
        except Exception:
            logger.exception(
                "Failed to truncate using tiktoken encoding '%s'",
                token_encoding_name,
            )

    # Fall back to a simple character limit.
    return text[:DEFAULT_TRUNCATE_CHARS]
