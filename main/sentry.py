"""Sentry setup and configuration"""

import logging

import sentry_sdk
from celery.exceptions import WorkerLostError
from sentry_sdk.integrations.celery import CeleryIntegration
from sentry_sdk.integrations.django import DjangoIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from sentry_sdk.integrations.redis import RedisIntegration

# these errors occur when a shutdown is happening (usually caused by a SIGTERM)
SHUTDOWN_ERRORS = (WorkerLostError, SystemExit)


log = logging.getLogger()


def before_send(event, hint):
    """
    Filter or transform events before they're sent to Sentry

    Args:
        event (dict): event object
        hints (dict): event hints, see https://docs.sentry.io/platforms/python/#hints

    Returns:
        dict or None: returns the modified event or None to filter out the event
    """
    if "exc_info" in hint:
        _, exc_value, _ = hint["exc_info"]
        if isinstance(exc_value, SHUTDOWN_ERRORS):
            # so we don't want to report expected shutdown errors to sentry
            return None
    return event


def init_sentry(  # noqa: PLR0913
    *,
    dsn,
    environment,
    version,
    log_level,
    traces_sample_rate,
    profiles_sample_rate,
):
    """
    Initializes sentry

    Args:
        dsn (str): the sentry DSN key
        environment (str): the application environment
        version (str): the version of the application
        log_level (str): the sentry log level
        traces_sample_rate (int): int between 0 and 100 for the sample rate
        profiles_sample_rate (int): int between 0 and 100 for the sample rate
    """  # noqa: D401
    if not 0 <= traces_sample_rate <= 1:
        log.error(
            "SENTRY_TRACES_SAMPLE_RATE should be between 0 <= x <= 1, defaulting to 0"
        )
        traces_sample_rate = 0

    if not 0 <= profiles_sample_rate <= 1:
        log.error(
            "SENTRY_PROFILES_SAMPLE_RATE should be between 0 <= x <= 1, defaulting to 0"
        )
        profiles_sample_rate = 0

    sentry_sdk.init(  # pylint:disable=abstract-class-instantiated
        dsn=dsn,
        environment=environment,
        release=version,
        before_send=before_send,
        traces_sample_rate=traces_sample_rate,
        profiles_sample_rate=profiles_sample_rate,
        # Sentry's auto-enabling integrations (langchain, boto3, openai, etc.)
        # import their target library at init time just to check whether it's
        # installed, regardless of whether it's ever used -- e.g. langchain is
        # installed as a litellm transitive dependency but never used directly,
        # and importing its Sentry integration alone pulls in the whole
        # langchain/tiktoken stack on every process. Opt in explicitly instead.
        auto_enabling_integrations=False,
        integrations=[
            DjangoIntegration(),
            CeleryIntegration(),
            LoggingIntegration(level=log_level),
            RedisIntegration(),
        ],
    )
