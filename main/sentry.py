"""Sentry setup and configuration"""

import logging

import sentry_sdk
from celery.exceptions import WorkerLostError
from sentry_sdk.integrations.boto3 import Boto3Integration
from sentry_sdk.integrations.celery import CeleryIntegration
from sentry_sdk.integrations.django import DjangoIntegration
from sentry_sdk.integrations.httpx import HttpxIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from sentry_sdk.integrations.redis import RedisIntegration

# these errors occur when a shutdown is happening (usually caused by a SIGTERM)
SHUTDOWN_ERRORS = (WorkerLostError, SystemExit)


log = logging.getLogger()


# Postgres appends a DETAIL line to constraint violations that echoes the whole
# offending row -- on a users table that is the learner's name, email and
# external UUID.  psycopg puts it in str(exc), so it ships inside the exception
# value, where no SDK privacy setting reaches it: send_default_pii governs
# user/cookie/header capture and max_request_body_size governs request bodies,
# and neither touches exception text.
PG_DETAIL_MARKER = "\nDETAIL:"
PG_DETAIL_REPLACEMENT = "\nDETAIL:  [scrubbed]"


def scrub_pg_detail(text):
    """Truncate a Postgres error string at its DETAIL line.

    Keeps the primary message, which is what identifies the failure, and drops
    the row echo plus any HINT/CONTEXT Postgres appends after it.
    """
    index = text.find(PG_DETAIL_MARKER)
    if index == -1:
        return text
    return text[:index] + PG_DETAIL_REPLACEMENT


def scrub_pg_details(event):
    """Apply scrub_pg_detail everywhere an error string lands on the event.

    Covers exception values, the logentry message/formatted pair, and the legacy
    top-level message, so the scrub holds whether the event arrived as an
    uncaught exception or via logger.exception.
    """
    for entry in (event.get("exception") or {}).get("values") or []:
        value = entry.get("value")
        if isinstance(value, str):
            entry["value"] = scrub_pg_detail(value)
    logentry = event.get("logentry")
    if isinstance(logentry, dict):
        for key in ("formatted", "message"):
            value = logentry.get(key)
            if isinstance(value, str):
                logentry[key] = scrub_pg_detail(value)
    top_message = event.get("message")
    if isinstance(top_message, str):
        event["message"] = scrub_pg_detail(top_message)
    return event


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
    return scrub_pg_details(event)


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
        # Request bodies are NOT gated on send_default_pii: the SDK sets
        # request.data unconditionally (sentry_sdk/integrations/_wsgi_common.py
        # :123) and this is the only control (:61).  Left unset it defaults to
        # "medium", i.e. 10,000-byte bodies -- enrollment, checkout, profile and
        # SCIM payloads.  Set explicitly so the choice is findable here rather
        # than in a dependency's defaults.
        max_request_body_size="small",
        traces_sample_rate=traces_sample_rate,
        profiles_sample_rate=profiles_sample_rate,
        # Sentry's auto-enabling integrations (langchain, openai, etc.) import
        # their target library at init time just to check whether it's
        # installed, regardless of whether it's ever used -- e.g. langchain is
        # installed as a litellm transitive dependency but never used directly,
        # and importing its Sentry integration alone pulls in the whole
        # langchain/tiktoken stack on every process. Opt in explicitly instead.
        # Boto3/Redis/Httpx are included because boto3, redis, and httpx are
        # already imported elsewhere at boot regardless of Sentry, so these
        # add no import cost of their own.
        auto_enabling_integrations=False,
        integrations=[
            DjangoIntegration(),
            CeleryIntegration(),
            LoggingIntegration(level=log_level),
            RedisIntegration(),
            Boto3Integration(),
            HttpxIntegration(),
        ],
    )
