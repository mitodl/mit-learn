"""
Regression test for OpenTelemetry HTTP tracing under ASGI.

The app is served over ASGI (Granian), so every inbound request is an
``ASGIRequest``. ``DjangoInstrumentor``'s middleware only creates a span for an
ASGI request when ``opentelemetry-instrumentation-asgi`` is importable; without
it, ``_is_asgi_supported`` is False and the middleware silently no-ops on every
request (producing zero HTTP server spans, at any speed). That package is not a
dependency of ``opentelemetry-instrumentation-django``, so it must be declared
explicitly. This test fails if it goes missing again.

The test drives the instrumented Django OTel middleware directly over a real
``ASGIRequest`` (rather than through the full async request stack) to keep it
synchronous and hermetic — the thing under test is whether the middleware emits
a span for an ASGI request.
"""

import io
import warnings

import pytest
from django.core.handlers.asgi import ASGIRequest
from django.http import HttpResponse
from django.urls import ResolverMatch
from opentelemetry.instrumentation.django import DjangoInstrumentor
from opentelemetry.instrumentation.django.middleware.otel_middleware import (
    _DjangoMiddleware,
)
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import (
    InMemorySpanExporter,
)
from opentelemetry.trace import SpanKind


@pytest.fixture
def span_exporter(settings):
    """Instrument Django's OTel middleware with an in-memory span exporter."""
    settings.ALLOWED_HOSTS = ["testserver"]

    exporter = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exporter))

    instrumentor = DjangoInstrumentor()
    # DjangoInstrumentor is a singleton; a prior instrument() would make this
    # call a no-op and drop our tracer_provider, so reset first. instrument()
    # sets the _DjangoMiddleware class attributes (tracer, meter, counters).
    instrumentor.uninstrument()
    instrumentor.instrument(tracer_provider=provider)
    try:
        yield exporter
    finally:
        instrumentor.uninstrument()
        exporter.clear()


def _asgi_request(path):
    scope = {
        "type": "http",
        "http_version": "1.1",
        "method": "GET",
        "path": path,
        "query_string": b"",
        "headers": [(b"host", b"testserver")],
        "server": ("testserver", 80),
        "client": ("127.0.0.1", 0),
        "scheme": "http",
    }
    return ASGIRequest(scope, io.BytesIO(b""))


def test_asgi_request_emits_http_server_span(span_exporter):
    """The Django OTel middleware emits an HTTP SERVER span for an ASGIRequest."""
    request = _asgi_request("/__otel_asgi_probe__/")
    # Preset resolver_match so the middleware's span-naming doesn't call
    # resolve() (which imports the whole URLconf) — the request never routes to
    # a view here; we only care that a SERVER span is produced.
    request.resolver_match = ResolverMatch(
        func=lambda _req: HttpResponse(),
        args=(),
        kwargs={},
        url_name="otel_asgi_probe",
        route="__otel_asgi_probe__/",
    )
    middleware = _DjangoMiddleware(lambda _req: HttpResponse("ok"))

    # The OTel instrumentation code path emits a pkg_resources DeprecationWarning
    # that this project escalates to an error; it's unrelated to what we assert.
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        middleware.process_request(request)
        middleware.process_response(request, HttpResponse("ok"))

    server_spans = [
        span
        for span in span_exporter.get_finished_spans()
        if span.kind is SpanKind.SERVER
    ]
    assert server_spans, (
        "No HTTP SERVER span emitted for an ASGIRequest — the Django OTel "
        "middleware is silently no-opping. Is 'opentelemetry-instrumentation-asgi' "
        "installed?"
    )
