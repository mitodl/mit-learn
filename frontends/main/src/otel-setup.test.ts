/**
 * The point of owning the OTel setup is that these properties hold without any
 * of the workarounds that used to produce them.
 */

import { ROOT_CONTEXT, trace } from "@opentelemetry/api"
import {
  SPAN_CREATION_SAMPLE_RATE,
  buildPropagator,
  buildResource,
} from "./otel-setup"

// The example ids from the W3C trace-context spec.
const TRACE_ID = "0af7651916cd43dd8448eb211c80319c" // pragma: allowlist secret
const SPAN_ID = "b7ad6b7169203331" // pragma: allowlist secret

describe("buildResource", () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("takes service.name from OTEL_SERVICE_NAME", () => {
    // Sentry's own provider hardcodes this to "node"
    // (getsentry/sentry-javascript#20502), which is what the deleted
    // ResourceAttributeOverrideSpanProcessor existed to undo.
    process.env.OTEL_SERVICE_NAME = "learn-nextjs"

    expect(buildResource().attributes["service.name"]).toBe("learn-nextjs")
  })

  it("parses OTEL_RESOURCE_ATTRIBUTES", () => {
    process.env.OTEL_RESOURCE_ATTRIBUTES =
      "deployment.environment=production,service.namespace=learn"

    const { attributes } = buildResource()

    expect(attributes["deployment.environment"]).toBe("production")
    expect(attributes["service.namespace"]).toBe("learn")
  })
})

describe("buildPropagator", () => {
  it("extracts a W3C traceparent", () => {
    const ctx = buildPropagator().extract(
      ROOT_CONTEXT,
      {
        traceparent: `00-${TRACE_ID}-${SPAN_ID}-01`,
      },
      { get: (c, k) => c[k], keys: (c) => Object.keys(c) },
    )

    expect(trace.getSpanContext(ctx)?.traceId).toBe(TRACE_ID)
  })
})

describe("SPAN_CREATION_SAMPLE_RATE", () => {
  it("creates every span, leaving keep/drop to the Alloy tail sampler", () => {
    // Head sampling below 1 cannot be undone downstream: a span that is never
    // created is a span Tempo never sees. This also has to stay above 0 to keep
    // hasSpansEnabled() true -- at 0 Sentry wraps startSpan/startInactiveSpan in
    // suppressTracing() and httpIntegration's server-span gate fails, both
    // silently. Sentry's own volume is beforeSendTransaction's job.
    expect(SPAN_CREATION_SAMPLE_RATE).toBe(1)
  })
})
