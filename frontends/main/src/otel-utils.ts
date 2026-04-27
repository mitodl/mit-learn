import { SpanKind } from "@opentelemetry/api"
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base"

const REQUEST_METHOD_KEYS = ["http.request.method", "http.method"] as const
const REQUEST_ROUTE_KEYS = [
  "http.route",
  "url.path",
  "http.target",
  "url.full",
] as const
const RESPONSE_STATUS_KEYS = [
  "http.response.status_code",
  "http.status_code",
] as const

export type RequestLogEntry = {
  message: "next_request"
  method: string
  route: string
  statusCode: number | null
  durationMs: number
  traceId: string
  spanId: string
  name: string
}

type ServiceNameEnvSubset = Readonly<Record<string, string | undefined>>
export type ServiceResourceOverrides = {
  resourceAttributes: Record<string, string>
  serviceName?: string
  serviceVersion?: string
}

function getNonEmptyEnvValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function getResourceOverrides(
  env: ServiceNameEnvSubset,
): Record<string, string> {
  const overrides: Record<string, string> = {}
  const attributes = getNonEmptyEnvValue(env.OTEL_RESOURCE_ATTRIBUTES)
  if (!attributes) {
    return overrides
  }

  for (const assignment of attributes.split(",")) {
    const trimmedAssignment = assignment.trim()
    if (!trimmedAssignment) {
      continue
    }
    const separatorIndex = trimmedAssignment.indexOf("=")
    if (separatorIndex <= 0) {
      continue
    }
    const key = trimmedAssignment.slice(0, separatorIndex).trim()
    const value = getNonEmptyEnvValue(
      trimmedAssignment.slice(separatorIndex + 1),
    )
    if (!value) {
      continue
    }

    overrides[key] = value
  }

  return overrides
}

export function parseServiceResourceOverrides(
  env: ServiceNameEnvSubset,
): ServiceResourceOverrides {
  return {
    resourceAttributes: getResourceOverrides(env),
    serviceName: getNonEmptyEnvValue(env.OTEL_SERVICE_NAME),
    serviceVersion: getNonEmptyEnvValue(env.NEXT_PUBLIC_VERSION),
  }
}

export function hasOtlpEndpointConfig(env: ServiceNameEnvSubset): boolean {
  return Boolean(
    getNonEmptyEnvValue(env.OTEL_EXPORTER_OTLP_ENDPOINT) ||
      getNonEmptyEnvValue(env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT),
  )
}

/**
 * Returns the first non-empty string attribute for the provided keys, in order.
 * Keys act as fallbacks to support multiple semantic conventions.
 */
function getStringAttribute(
  span: ReadableSpan,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = span.attributes[key]
    if (typeof value === "string" && value.length > 0) {
      return value
    }
  }
  return undefined
}

/**
 * Returns the first finite numeric attribute for the provided keys, in order.
 * Keys act as fallbacks to support multiple semantic conventions.
 */
function getNumberAttribute(
  span: ReadableSpan,
  keys: readonly string[],
): number | undefined {
  for (const key of keys) {
    const value = span.attributes[key]
    if (typeof value === "number" && Number.isFinite(value)) {
      return value
    }
  }
  return undefined
}

function getDurationMs(duration: [number, number]): number {
  // HrTime is [seconds, nanoseconds], with nanoseconds normalized to < 1e9.
  // Convert each component to milliseconds and add.
  return Math.round(duration[0] * 1_000 + duration[1] / 1_000_000)
}

export function createRequestLogEntry(
  span: ReadableSpan,
): RequestLogEntry | null {
  if (span.kind !== SpanKind.SERVER) {
    return null
  }

  // Span attribute keys differ across OTEL semantic convention versions and
  // instrumentation libraries, so we read from ordered fallback key lists.
  const context = span.spanContext()
  const method = getStringAttribute(span, REQUEST_METHOD_KEYS) ?? "UNKNOWN"
  const route = getStringAttribute(span, REQUEST_ROUTE_KEYS) ?? span.name
  const statusCode = getNumberAttribute(span, RESPONSE_STATUS_KEYS) ?? null

  return {
    message: "next_request",
    method,
    route,
    statusCode,
    durationMs: getDurationMs(span.duration),
    traceId: context.traceId,
    spanId: context.spanId,
    name: span.name,
  }
}

export function applyResourceOverrides(
  span: ReadableSpan,
  overrides: ServiceResourceOverrides,
): void {
  for (const [key, value] of Object.entries(overrides.resourceAttributes)) {
    span.resource.attributes[key] = value
  }

  if (overrides.serviceName) {
    span.resource.attributes["service.name"] = overrides.serviceName
  }
  if (overrides.serviceVersion) {
    span.resource.attributes["service.version"] = overrides.serviceVersion
  }
}
