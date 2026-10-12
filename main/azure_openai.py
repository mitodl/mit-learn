"""Azure OpenAI connection settings for LiteLLM, authenticated with Entra ID"""

from collections.abc import Callable
from functools import cache

from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

AZURE_MODEL_PREFIX = "azure/"
COGNITIVE_SERVICES_SCOPE = "https://cognitiveservices.azure.com/.default"


def is_azure_model(model: str | None) -> bool:
    """Return True if a LiteLLM model string opts in to Azure OpenAI."""
    return bool(model) and model.startswith(AZURE_MODEL_PREFIX)


def strip_azure_prefix(model: str | None) -> str | None:
    """
    Return the model name without the "azure/" prefix.

    The Azure deployments are named after the OpenAI models they serve, so this
    is the name to use for tokenizer, dimension, and model-list lookups.
    """
    if is_azure_model(model):
        return model.removeprefix(AZURE_MODEL_PREFIX)
    return model


@cache
def azure_ad_token_provider() -> Callable[[], str]:
    """
    Return a process-wide bearer token provider for Azure OpenAI.

    DefaultAzureCredential resolves to workload identity in the cluster and to
    the Azure CLI login locally. The provider caches the token and refreshes it
    before it expires, so it is built once rather than per request.
    """
    return get_bearer_token_provider(DefaultAzureCredential(), COGNITIVE_SERVICES_SCOPE)


def azure_openai_litellm_params() -> dict:
    """
    Return the kwargs that route a litellm.completion() or embedding() call to
    Azure OpenAI.

    custom_llm_provider has to be "azure" rather than LITELLM_CUSTOM_PROVIDER:
    with "openai" litellm keeps the "azure/" prefix in the model name and sends
    the request to OpenAI.

    Returns:
        dict: kwargs for litellm
    """
    if not settings.AZURE_OPENAI_ENDPOINT:
        msg = f"AZURE_OPENAI_ENDPOINT must be set to use a '{AZURE_MODEL_PREFIX}' model"
        raise ImproperlyConfigured(msg)
    return {
        "custom_llm_provider": "azure",
        "api_base": settings.AZURE_OPENAI_ENDPOINT,
        "api_version": settings.AZURE_OPENAI_API_VERSION or None,
        "azure_ad_token_provider": azure_ad_token_provider(),
    }


def azure_openai_chat_litellm_kwargs() -> dict:
    """
    Return the ChatLiteLLM kwargs that route a request to Azure OpenAI.

    ChatLiteLLM has no fields for the Azure params, so they go through
    model_kwargs, which it passes to litellm.completion(). The endpoint goes in
    as base_url rather than ChatLiteLLM's api_base, because ChatLiteLLM copies
    api_base onto the litellm module on every call, and litellm falls back to
    that global for calls that don't pass their own (e.g. OpenAI embeddings
    when LITELLM_API_BASE is unset).

    Returns:
        dict: kwargs for ChatLiteLLM
    """
    params = azure_openai_litellm_params()
    return {
        "custom_llm_provider": params.pop("custom_llm_provider"),
        "model_kwargs": {"base_url": params.pop("api_base"), **params},
    }
