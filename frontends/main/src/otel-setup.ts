/**
 * OpenTelemetry wiring shared between server startup and its tests.
 *
 * Exists so the composition below has exactly one definition. A test that
 * rebuilt the composite itself would keep passing after someone reordered or
 * dropped a propagator in production, which is the failure it is meant to
 * catch.
 */

import {
  CompositePropagator,
  W3CBaggagePropagator,
  W3CTraceContextPropagator,
} from "@opentelemetry/core"
import { SentryPropagator } from "@sentry/opentelemetry"

/**
 * Propagator that reads W3C *and* Sentry headers.
 *
 * Sentry's SentryPropagator.extract() reads only sentry-trace and baggage,
 * never traceparent, while its inject() does write one. That asymmetry drops
 * every W3C-only caller -- Traefik fronts next.learn.mit.edu and sends
 * traceparent, so the SSR render started a fresh trace instead of continuing
 * the edge's.
 *
 * Order matters. Sentry goes last so it still wins when sentry-trace is
 * present, keeping browser-originated traces as they are; its extract()
 * returns the context untouched when that header is absent, so W3C's
 * extraction survives for edge traffic.
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
