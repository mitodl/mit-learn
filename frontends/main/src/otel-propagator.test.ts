/**
 * Pins the propagator composition that lets the SSR runtime continue a trace
 * started at the edge.
 *
 * Sentry's SentryPropagator.extract() reads only sentry-trace and baggage, so
 * on its own every W3C-only caller is dropped. Traefik fronts
 * next.learn.mit.edu and sends traceparent, which is exactly that case.
 */

import { propagation, trace, ROOT_CONTEXT } from "@opentelemetry/api"
import {
  CompositePropagator,
  W3CBaggagePropagator,
  W3CTraceContextPropagator,
} from "@opentelemetry/core"
import { SentryPropagator } from "@sentry/opentelemetry"

const TRACE_ID = "0af7651916cd43dd8448eb211c80319c"
const SPAN_ID = "b7ad6b7169203331"

const composite = () =>
  new CompositePropagator({
    propagators: [
      new W3CTraceContextPropagator(),
      new W3CBaggagePropagator(),
      new SentryPropagator(),
    ],
  })

const extractedSpanContext = (
  propagator: { extract: typeof propagation.extract },
  carrier: Record<string, string>,
) => {
  const ctx = propagator.extract(ROOT_CONTEXT, carrier, {
    get: (c, k) => c[k],
    keys: (c) => Object.keys(c),
  })
  return trace.getSpanContext(ctx)
}

describe("OTel propagator composition", () => {
  it("drops a W3C traceparent when only Sentry's propagator is used", () => {
    // The bug this composition exists to fix. If this ever starts passing,
    // Sentry has learned to read traceparent and the composite can go.
    const spanContext = extractedSpanContext(new SentryPropagator(), {
      traceparent: `00-${TRACE_ID}-${SPAN_ID}-01`,
    })

    expect(spanContext).toBeUndefined()
  })

  it("continues a trace from a W3C traceparent", () => {
    const spanContext = extractedSpanContext(composite(), {
      traceparent: `00-${TRACE_ID}-${SPAN_ID}-01`,
    })

    expect(spanContext?.traceId).toBe(TRACE_ID)
    expect(spanContext?.spanId).toBe(SPAN_ID)
  })

  it("still continues a trace from sentry-trace", () => {
    const spanContext = extractedSpanContext(composite(), {
      "sentry-trace": `${TRACE_ID}-${SPAN_ID}-1`,
    })

    expect(spanContext?.traceId).toBe(TRACE_ID)
  })

  it("lets sentry-trace win when both headers are present", () => {
    // Sentry is last in the composite deliberately, so browser-originated
    // traces keep the behaviour they have today.
    const sentryTraceId = "11111111111111111111111111111111"
    const spanContext = extractedSpanContext(composite(), {
      traceparent: `00-${TRACE_ID}-${SPAN_ID}-01`,
      "sentry-trace": `${sentryTraceId}-${SPAN_ID}-1`,
    })

    expect(spanContext?.traceId).toBe(sentryTraceId)
  })
})
