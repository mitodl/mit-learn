"""Sentry setup and configuration"""

import logging
import re

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
#
# The newline is matched both raw and as a literal backslash-n: the SDK repr()s
# frame locals and non-string logging params during serialization, so there the
# DETAIL line arrives as "...constraint\\nDETAIL: ..." inside a repr string.
PG_DETAIL_RE = re.compile(r"(\n|\\n)DETAIL:.*", re.DOTALL)


def scrub_pg_detail(text):
    """Truncate a Postgres error string at its DETAIL line.

    Keeps the primary message, which is what identifies the failure, and drops
    the row echo plus any HINT/CONTEXT Postgres appends after it.
    """
    return PG_DETAIL_RE.sub(
        lambda match: match.group(1) + "DETAIL:  [scrubbed]", text, count=1
    )


def scrub_pg_details(event):
    """Truncate Postgres DETAIL lines everywhere in a Sentry event.

    The row echo reaches Sentry through more fields than the exception value:
    LoggingIntegration puts the log message in a breadcrumb
    (BreadcrumbHandler._breadcrumb_from_record), logger.error("...: %s", exc)
    puts it in logentry.params (EventHandler._emit), and captured stack-frame
    locals carry it in frame vars because include_local_variables defaults to
    True (serialize_frame).  Walking the whole event covers those without
    enumerating them, and does not go stale when the SDK adds another.

    Safe to walk naively because Client._prepare_event serializes the event
    before calling before_send, so every leaf here is already a JSON
    primitive -- no live exception objects to coerce.
    """
    return _scrub_node(event)


def _scrub_node(node):
    """Recurse through the serialized event, rewriting strings in place."""
    if isinstance(node, str):
        return scrub_pg_detail(node)
    if isinstance(node, dict):
        for key, value in node.items():
            node[key] = _scrub_node(value)
        return node
    if isinstance(node, list):
        node[:] = [_scrub_node(item) for item in node]
        return node
    return node


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
        # request.data unconditionally (RequestExtractor.extract_into_event)
        # and this is the only control (request_body_within_bounds).  Left
        # unset it defaults to "medium", i.e. 10,000-byte bodies.  Set
        # explicitly so the choice is findable here rather than in a
        # dependency's defaults.
        #
        # This applies to every Django view, the webhooks included.  The
        # content_files webhook posts a few short fields (content_path, source,
        # course ids), so its bodies still fit under the bound.
        #
        # It is not a hard 1KB cap: the bound is checked against the declared
        # Content-Length, and a missing one counts as 0.  Under ASGI (granian
        # serving main.asgi), Django takes CONTENT_LENGTH from the request
        # header, so a chunked request without one has its parsed body
        # captured in full.
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
