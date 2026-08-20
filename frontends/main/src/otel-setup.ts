/**
 * Own the OpenTelemetry setup instead of letting Sentry own it.
 *
 * Sentry's SDK, left to itself, builds the whole pipeline (see initOtel.ts in
 * @sentry/node):
 *
 *   new NodeTracerProvider({
 *     sampler:  new SentrySampler(client),
 *     resource: getSentryResource('node'),
 *     spanProcessors: [new SentrySpanProcessor(...), ...ours],
 *   })
 *   propagation.setGlobalPropagator(new SentryPropagator())
 *   context.setGlobalContextManager(new SentryContextManager())
 *
 * Two of those are wrong for us:
 *
 * - `getSentryResource('node')` hardcodes service.name to "node"
 *   (getsentry/sentry-javascript#20502), which is why this codebase used to
 *   carry a span processor that rewrote every span's resource on the way out.
 *   Owning the provider means passing the real Resource once, at construction.
 * - `SentryPropagator.extract()` reads only sentry-trace and baggage, never
 *   traceparent, so W3C callers -- Traefik, which fronts next.learn.mit.edu --
 *   were dropped and the SSR render started a fresh trace.
 *
 * Everything else is Sentry's, deliberately. The sampler in particular: it is
 * tempting to swap in a plain OTel sampler so span creation is decoupled from
 * `tracesSampleRate`, but `SentrySampler` is the only thing that emits the
 * `beforeSampling` hook -- @sentry/nextjs registers a listener on it whose only
 * job is to drop spans for Sentry-ingest requests the Node server forwards on
 * behalf of the Edge runtime -- and the only thing that routes its decision
 * through `wrapSamplingDecision`, which writes sample_rate and sample_rand onto
 * the trace state that becomes the outgoing baggage DSC. A replacement sampler
 * silently loses both.
 *
 * Keeping it costs nothing here, because separating the two destinations does
 * not actually need a second sampler:
 *
 *   span creation   -> tracesSampleRate, pinned at 1 (below)
 *   Tempo keep/drop -> the Grafana Alloy tail sampler, once it sees the trace
 *   Sentry volume   -> beforeSendTransaction, applied after the span exists
 *
 * Its span processor is first in the chain, and its context manager is kept,
 * because Sentry's async context handling is what keeps spans attached across
 * Next.js's request boundaries.
 */

import { context, propagation, trace } from "@opentelemetry/api"
import {
  CompositePropagator,
  W3CBaggagePropagator,
  W3CTraceContextPropagator,
} from "@opentelemetry/core"
import {
  defaultResource,
  detectResources,
  envDetector,
} from "@opentelemetry/resources"
import type { Resource } from "@opentelemetry/resources"
import { BasicTracerProvider } from "@opentelemetry/sdk-trace-base"
import type { SpanProcessor } from "@opentelemetry/sdk-trace-base"
import { SentryContextManager, getClient } from "@sentry/nextjs"
import {
  SentryPropagator,
  SentrySampler,
  SentrySpanProcessor,
} from "@sentry/opentelemetry"
import type { OpenTelemetryClient } from "@sentry/opentelemetry"

/**
 * Passed to Sentry.init as `tracesSampleRate`. Governs span *creation*.
 *
 * Must stay at 1, for two independent reasons.
 *
 * It is the head sampling rate SentrySampler applies, and every span that is
 * never created is a span Tempo never sees. The real keep/drop belongs to the
 * Alloy tail sampler, which can only decide once it has the whole trace, so
 * head sampling below 1 here just starves it. This does not set Sentry's
 * volume -- beforeSendTransaction does, after the span already exists.
 *
 * It is also what makes hasSpansEnabled() true. At 0 (or unset) that returns
 * false, and two things break quietly: Sentry's own span APIs
 * (startSpan/startInactiveSpan) wrap their context in suppressTracing(), so
 * every span Sentry or the Next.js integration creates goes non-recording; and
 * httpIntegration's `enableServerSpans && hasSpansEnabled(clientOptions)` gate
 * fails. Verified against @sentry/opentelemetry and @sentry/node 10.50.0.
 */
export const SPAN_CREATION_SAMPLE_RATE = 1

/**
 * Resource built from OTEL_SERVICE_NAME and OTEL_RESOURCE_ATTRIBUTES via the
 * SDK's own spec-compliant parser, layered over the SDK defaults.
 *
 * This is the piece that replaces the resource-rewriting span processor: set
 * once here rather than patched onto every span at export time.
 */
export function buildResource(): Resource {
  return defaultResource().merge(detectResources({ detectors: [envDetector] }))
}

/**
 * Propagator that reads W3C *and* Sentry headers.
 *
 * Sentry is last so it still wins when sentry-trace is present, leaving
 * browser-originated traces as they are; its extract() returns the context
 * untouched when that header is absent, so W3C survives for edge traffic.
 */
export function buildPropagator(): CompositePropagator {
  return new CompositePropagator({
    propagators: [
      new W3CTraceContextPropagator(),
      new W3CBaggagePropagator(),
      new SentryPropagator(),
    ],
  })
}

/**
 * Install the provider and the two globals Sentry would otherwise install.
 *
 * Must run AFTER Sentry.init({ skipOpenTelemetrySetup: true }): SentrySampler
 * and SentrySpanProcessor both need a client, and Sentry has by then declined
 * to register its own globals -- setGlobalPropagator and
 * setGlobalContextManager both refuse a second registration and silently
 * return false.
 *
 * Returns undefined when there is no client, which is the `next build` case:
 * @sentry/nextjs's init() returns before creating one when NEXT_PHASE is
 * PHASE_PRODUCTION_BUILD. There is nothing to trace in a build.
 */
export function installOpenTelemetry({
  spanProcessors = [],
}: {
  spanProcessors?: SpanProcessor[]
} = {}): BasicTracerProvider | undefined {
  const client = getClient()
  if (!client) {
    return undefined
  }

  const provider = new BasicTracerProvider({
    resource: buildResource(),
    sampler: new SentrySampler(client),
    // Matches what Sentry's own setupOtel() passes. The SDK default is 30s,
    // which is longer than the 2s budget Sentry.flush(2000) gives it.
    forceFlushTimeoutMillis: 500,
    // Sentry first so it sees every recorded span; ours follow and export to
    // Alloy independently of whether Sentry keeps it.
    spanProcessors: [new SentrySpanProcessor(), ...spanProcessors],
  })

  trace.setGlobalTracerProvider(provider)
  context.setGlobalContextManager(new SentryContextManager())
  propagation.setGlobalPropagator(buildPropagator())

  // The global provider is not what Sentry flushes. NodeClient.flush() awaits
  // `this.traceProvider?.forceFlush()`, and that field is only ever set by
  // Sentry's own initOpenTelemetry() -- which skipOpenTelemetrySetup skips. Left
  // unset, the Sentry.flush(2000) calls in captureRequestError,
  // wrapRouteHandlerWithSentry and wrapServerComponentWithSentry are no-ops for
  // spans, and since nothing here hooks SIGTERM or beforeExit either, a pod
  // rollout drops whatever the BatchSpanProcessor is still holding.
  ;(client as unknown as OpenTelemetryClient).traceProvider = provider

  return provider
}
