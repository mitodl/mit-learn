import type { IncomingMessage, ServerResponse } from "node:http"
import { createRequestLogEntry, hasOtlpEndpointConfig } from "./otel-utils"

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
      query: null,
      statusCode: 200,
      durationMs: 1250,
      traceId: null,
      spanId: null,
      version: "test-version",
    })
  })

  it("splits route and query when the URL has a query string", () => {
    const request = {
      method: "POST",
      url: "/api/foo?bar=baz&qux=1",
    } as IncomingMessage
    const response = { statusCode: 201 } as ServerResponse

    const entry = createRequestLogEntry({ request, response, durationMs: 5 })
    expect(entry.route).toBe("/api/foo")
    expect(entry.query).toBe("bar=baz&qux=1")
  })

  it("falls back to UNKNOWN when method is missing", () => {
    const request = { url: "/" } as IncomingMessage
    const response = { statusCode: 500 } as ServerResponse

    expect(
      createRequestLogEntry({ request, response, durationMs: 1 }).method,
    ).toBe("UNKNOWN")
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
