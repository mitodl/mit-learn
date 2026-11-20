"""ol-llm configuration shared by mit-learn's LLM call sites."""

from functools import cache

import ol_llm
from django.conf import settings


@cache
def configure_ol_llm() -> None:
    """
    Configure ol-llm for this process, once.

    Import this module only where ol-llm is used: importing ol_llm loads opik,
    which main/boot_imports_test.py keeps off the boot path.
    """
    ol_llm.configure(ol_llm.Settings(environment=settings.OL_LLM_ENVIRONMENT))
    ol_llm.configure_tracing(
        None if settings.OPIK_URL_OVERRIDE else ol_llm.TracingConfig(enabled=False)
    )
