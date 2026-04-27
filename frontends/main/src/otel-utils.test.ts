import type { IncomingMessage, ServerResponse } from "node:http"
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base"
import {
  applyResourceOverrides,
  createRequestLogEntry,
  detectResourceOverrides,
  hasOtlpEndpointConfig,
} from "./otel-utils"

function makeResource(
  attributes: ReadableSpan["resource"]["attributes"] = {},
): ReadableSpan["resource"] {
  const resource: ReadableSpan["resource"] = {
    attributes,
    merge(other) {
      return other ?? resource
    },
    getRawAttributes() {
      return Object.entries(resource.attributes)
    },
  }
  return resource
}

const makeReadableSpan = (
  overrides: Partial<ReadableSpan> = {},
): ReadableSpan => ({
  name: "test span",
  kind: 0,
  spanContext: () => ({
    traceId: "trace-id",
    spanId: "span-id",
    traceFlags: 1,
  }),
  startTime: [0, 0],
  endTime: [0, 0],
  status: { code: 0 },
  attributes: {},
  links: [],
  events: [],
  duration: [0, 0],
  ended: true,
  resource: makeResource(),
  instrumentationScope: { name: "test-scope", version: "1.0.0" },
  droppedAttributesCount: 0,
  droppedEventsCount: 0,
  droppedLinksCount: 0,
  ...overrides,
})

describe("createRequestLogEntry", () => {
  it("builds a log entry from request and response", () => {
    const request = { method: "GET", url: "/courses" } as IncomingMessage
    const response = { statusCode: 200 } as ServerResponse

    expect(
      createRequestLogEntry({ request, response, durationMs: 1250 }),
    ).toEqual({
      message: "next_request",
      method: "GET",
      route: "/courses",
      statusCode: 200,
      durationMs: 1250,
      traceId: null,
      spanId: null,
      version: "test-version",
    })
  })

  it("strips the query string from the route", () => {
    const request = {
      method: "POST",
      url: "/api/foo?bar=baz&qux=1",
    } as IncomingMessage
    const response = { statusCode: 201 } as ServerResponse

    expect(
      createRequestLogEntry({ request, response, durationMs: 5 }).route,
    ).toBe("/api/foo")
  })

  it("falls back to UNKNOWN when method is missing", () => {
    const request = { url: "/" } as IncomingMessage
    const response = { statusCode: 500 } as ServerResponse

    expect(
      createRequestLogEntry({ request, response, durationMs: 1 }).method,
    ).toBe("UNKNOWN")
  })
})

describe("applyResourceOverrides", () => {
  it("copies overrides onto the span resource", () => {
    const span = makeReadableSpan({
      resource: makeResource({
        "service.name": "node",
        "service.namespace": "sentry",
      }),
    })

    applyResourceOverrides(span, {
      "service.name": "learn-nextjs",
      "deployment.environment.name": "prod",
    })

    expect(span.resource.attributes["service.name"]).toBe("learn-nextjs")
    expect(span.resource.attributes["service.namespace"]).toBe("sentry")
    expect(span.resource.attributes["deployment.environment.name"]).toBe("prod")
  })

  it("leaves the resource unchanged when overrides is empty", () => {
    const span = makeReadableSpan({
      resource: makeResource({ "service.name": "node" }),
    })

    applyResourceOverrides(span, {})

    expect(span.resource.attributes["service.name"]).toBe("node")
  })

  it("skips non-string values defensively", () => {
    const span = makeReadableSpan({
      resource: makeResource({ "service.name": "node" }),
    })

    applyResourceOverrides(span, {
      "service.name": "learn-nextjs",
      "broken.promise": Promise.resolve("ignored"),
      "broken.array": ["a", "b"],
    })

    expect(span.resource.attributes["service.name"]).toBe("learn-nextjs")
    expect(span.resource.attributes["broken.promise"]).toBeUndefined()
    expect(span.resource.attributes["broken.array"]).toBeUndefined()
  })
})

describe("detectResourceOverrides", () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it("parses OTEL_SERVICE_NAME and OTEL_RESOURCE_ATTRIBUTES via the SDK", () => {
    process.env.OTEL_SERVICE_NAME = "app-name"
    process.env.OTEL_RESOURCE_ATTRIBUTES =
      "service.namespace=learn,service.version=1.2.3"

    expect(detectResourceOverrides()).toEqual({
      "service.name": "app-name",
      "service.namespace": "learn",
      "service.version": "1.2.3",
    })
  })

  it("percent-decodes values per the OTEL spec", () => {
    process.env.OTEL_RESOURCE_ATTRIBUTES =
      "deployment.environment.name=us%2Ceast,service.version=1%3D2"
    delete process.env.OTEL_SERVICE_NAME

    expect(detectResourceOverrides()).toEqual({
      "deployment.environment.name": "us,east",
      "service.version": "1=2",
    })
  })

  it("returns an empty object when no env vars are set", () => {
    delete process.env.OTEL_SERVICE_NAME
    delete process.env.OTEL_RESOURCE_ATTRIBUTES

    expect(detectResourceOverrides()).toEqual({})
  })
})

describe("hasOtlpEndpointConfig", () => {
  it("returns true when only OTEL_EXPORTER_OTLP_TRACES_ENDPOINT is set", () => {
    expect(
      hasOtlpEndpointConfig({
        OTEL_EXPORTER_OTLP_TRACES_ENDPOINT:
          "http://alloy.monitoring:4318/v1/traces",
      }),
    ).toBe(true)
  })
})
