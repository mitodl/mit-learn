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
 * Three of those are wrong for us:
 *
 * - `getSentryResource('node')` hardcodes service.name to "node"
 *   (getsentry/sentry-javascript#20502), which is why this codebase used to
 *   carry a span processor that rewrote every span's resource on the way out.
 *   Owning the provider means passing the real Resource once, at construction.
 * - `SentryPropagator.extract()` reads only sentry-trace and baggage, never
 *   traceparent, so W3C callers -- Traefik, which fronts next.learn.mit.edu --
 *   were dropped and the SSR render started a fresh trace.
 * - `SentrySampler` applies Sentry's `tracesSampleRate` to span *creation*,
 *   which makes one knob govern both destinations. Ours is a plain OTel
 *   sampler, so Sentry's rate becomes a Sentry-only concern applied by
 *   `beforeSendTransaction` after the span already exists.
 *
 * Sentry still gets everything it needs: its span processor is first in the
 * chain, and its context manager is kept, because Sentry's async context
 * handling is what keeps spans attached across Next.js's request boundaries.
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
import {
  BasicTracerProvider,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from "@opentelemetry/sdk-trace-base"
import type { SpanProcessor } from "@opentelemetry/sdk-trace-base"
import { SentryContextManager } from "@sentry/nextjs"
import { SentryPropagator, SentrySpanProcessor } from "@sentry/opentelemetry"

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
 * Sampler for span *creation*, which is a CPU question, not a storage one.
 *
 * ParentBased so an upstream decision is honoured: Traefik is the root for
 * next.learn.mit.edu and samples every request, and the Grafana Alloy tail
 * sampler makes the real keep/drop call once it can see the whole trace. Head
 * sampling below 1.0 here only starves that.
 */
export function buildSampler(sampleRate: number): ParentBasedSampler {
  return new ParentBasedSampler({
    root: new TraceIdRatioBasedSampler(sampleRate),
  })
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
 * Must run AFTER Sentry.init({ skipOpenTelemetrySetup: true }) so a Sentry
 * client exists for SentrySpanProcessor to report through, and so Sentry has
 * already declined to register its own globals -- setGlobalPropagator and
 * setGlobalContextManager both refuse a second registration and silently
 * return false.
 */
export function installOpenTelemetry({
  sampleRate,
  spanProcessors = [],
}: {
  sampleRate: number
  spanProcessors?: SpanProcessor[]
}): BasicTracerProvider {
  const provider = new BasicTracerProvider({
    resource: buildResource(),
    sampler: buildSampler(sampleRate),
    // Sentry first so it sees every recorded span; ours follow and export to
    // Alloy independently of whether Sentry keeps it.
    spanProcessors: [new SentrySpanProcessor(), ...spanProcessors],
  })

  trace.setGlobalTracerProvider(provider)
  context.setGlobalContextManager(new SentryContextManager())
  propagation.setGlobalPropagator(buildPropagator())

  return provider
}
