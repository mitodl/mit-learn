import { SpanKind, SpanStatusCode, TraceFlags } from "@opentelemetry/api"
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base"
import { mergeOverrides, PartialFactory } from "ol-test-utilities"
import {
  applyResourceOverrides,
  createRequestLogEntry,
  parseServiceResourceOverrides,
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

const makeReadableSpan: PartialFactory<ReadableSpan> = (overrides = {}) => {
  const base: ReadableSpan = {
    name: "test span",
    kind: SpanKind.INTERNAL,
    spanContext: () => ({
      traceId: "trace-id",
      spanId: "span-id",
      traceFlags: TraceFlags.SAMPLED,
    }),
    startTime: [0, 0],
    endTime: [0, 0],
    status: { code: SpanStatusCode.UNSET },
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
  }

  return mergeOverrides<ReadableSpan>(base, overrides)
}

describe("createRequestLogEntry", () => {
  it("creates a request log entry for server spans", () => {
    const span = makeReadableSpan({
      kind: SpanKind.SERVER,
      name: "GET /courses",
      attributes: {
        "http.request.method": "GET",
        "url.path": "/courses",
        "http.response.status_code": 200,
      },
      duration: [1, 250_000_000],
    })

    expect(createRequestLogEntry(span)).toEqual({
      message: "next_request",
      method: "GET",
      route: "/courses",
      statusCode: 200,
      durationMs: 1250,
      traceId: "trace-id",
      spanId: "span-id",
      name: "GET /courses",
    })
  })

  it("returns null for non-server spans", () => {
    const span = makeReadableSpan({
      kind: SpanKind.CLIENT,
      name: "GET api",
      duration: [0, 100_000],
    })

    expect(createRequestLogEntry(span)).toBeNull()
  })
})

describe("applyResourceOverrides", () => {
  it("overrides resource service.name when OTEL_SERVICE_NAME is set", () => {
    const span = makeReadableSpan({
      resource: makeResource({
        "service.name": "node",
        "service.namespace": "sentry",
      }),
    })

    const overrides = parseServiceResourceOverrides({
      OTEL_SERVICE_NAME: "learn-nextjs",
    })
    applyResourceOverrides(span, overrides)

    expect(span.resource.attributes["service.name"]).toBe("learn-nextjs")
    expect(span.resource.attributes["service.namespace"]).toBe("sentry")
  })

  it("does not change resource attributes when OTEL_SERVICE_NAME is unset", () => {
    const span = makeReadableSpan({
      resource: makeResource({
        "service.name": "node",
      }),
    })

    const overrides = parseServiceResourceOverrides({})
    applyResourceOverrides(span, overrides)

    expect(span.resource.attributes["service.name"]).toBe("node")
  })

  it("overrides service namespace and version from OTEL_RESOURCE_ATTRIBUTES", () => {
    const span = makeReadableSpan({
      resource: makeResource({
        "service.name": "node",
        "service.namespace": "sentry",
        "service.version": "10.50.0",
      }),
    })

    const overrides = parseServiceResourceOverrides({
      OTEL_RESOURCE_ATTRIBUTES:
        "service.namespace=my-namespace,service.version=2026.04.24",
    })
    applyResourceOverrides(span, overrides)

    expect(span.resource.attributes["service.name"]).toBe("node")
    expect(span.resource.attributes["service.namespace"]).toBe("my-namespace")
    expect(span.resource.attributes["service.version"]).toBe("2026.04.24")
  })

  it("prefers OTEL_SERVICE_NAME over service.name in OTEL_RESOURCE_ATTRIBUTES", () => {
    const span = makeReadableSpan({
      resource: makeResource({
        "service.name": "node",
      }),
    })

    const overrides = parseServiceResourceOverrides({
      OTEL_SERVICE_NAME: "env-service-name",
      OTEL_RESOURCE_ATTRIBUTES:
        "service.name=resource-attrs-name,service.namespace=my-namespace",
    })
    applyResourceOverrides(span, overrides)

    expect(span.resource.attributes["service.name"]).toBe("env-service-name")
    expect(span.resource.attributes["service.namespace"]).toBe("my-namespace")
  })

  it("applies arbitrary resource attributes from OTEL_RESOURCE_ATTRIBUTES", () => {
    const span = makeReadableSpan({
      resource: makeResource({
        "service.name": "node",
      }),
    })

    const overrides = parseServiceResourceOverrides({
      OTEL_RESOURCE_ATTRIBUTES:
        "deployment.environment.name=prod,cloud.region=us-east-1",
    })
    applyResourceOverrides(span, overrides)

    expect(span.resource.attributes["deployment.environment.name"]).toBe("prod")
    expect(span.resource.attributes["cloud.region"]).toBe("us-east-1")
  })

  it("overrides service.version from NEXT_PUBLIC_VERSION", () => {
    const span = makeReadableSpan({
      resource: makeResource({
        "service.version": "10.50.0",
      }),
    })

    const overrides = parseServiceResourceOverrides({
      NEXT_PUBLIC_VERSION: "release-2026-04-24",
      OTEL_RESOURCE_ATTRIBUTES: "service.version=resource-attrs-version",
    })
    applyResourceOverrides(span, overrides)

    expect(span.resource.attributes["service.version"]).toBe(
      "release-2026-04-24",
    )
  })
})

describe("parseServiceResourceOverrides", () => {
  it("parses OTEL_RESOURCE_ATTRIBUTES and OTEL_SERVICE_NAME into one override object", () => {
    expect(
      parseServiceResourceOverrides({
        OTEL_SERVICE_NAME: "app-name",
        NEXT_PUBLIC_VERSION: "release-1.2.3",
        OTEL_RESOURCE_ATTRIBUTES:
          "service.namespace=learn,service.version=1.2.3",
      }),
    ).toEqual({
      serviceName: "app-name",
      serviceVersion: "release-1.2.3",
      resourceAttributes: {
        "service.namespace": "learn",
        "service.version": "1.2.3",
      },
    })
  })
})
