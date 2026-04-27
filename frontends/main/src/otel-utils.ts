import { SpanKind } from "@opentelemetry/api"
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base"
import { envDetector } from "@opentelemetry/resources"
import type { DetectedResourceAttributes } from "@opentelemetry/resources"

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
  version: string | null
}

const APP_VERSION = process.env.NEXT_PUBLIC_VERSION ?? null

type OtelEnvSubset = Readonly<Record<string, string | undefined>>

function getNonEmptyEnvValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function hasOtlpEndpointConfig(env: OtelEnvSubset): boolean {
  return Boolean(
    getNonEmptyEnvValue(env.OTEL_EXPORTER_OTLP_ENDPOINT) ||
      getNonEmptyEnvValue(env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT),
  )
}

/**
 * Read OTEL_SERVICE_NAME and OTEL_RESOURCE_ATTRIBUTES from process.env using
 * the OTEL SDK's spec-compliant parser. Handles percent-decoding, length
 * checks, and merges OTEL_SERVICE_NAME into service.name.
 */
export function detectResourceOverrides(): DetectedResourceAttributes {
  return envDetector.detect().attributes ?? {}
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
    version: APP_VERSION,
  }
}

/**
 * Copy detected resource attributes onto a span's resource. Used to work
 * around Sentry's hardcoded service.name (and friends) — see
 * https://github.com/getsentry/sentry-javascript/issues/20502.
 *
 * EnvDetector returns AttributeValue | Promise<AttributeValue> | undefined,
 * but in practice OTEL_SERVICE_NAME and OTEL_RESOURCE_ATTRIBUTES yield only
 * strings; non-strings are skipped defensively.
 */
export function applyResourceOverrides(
  span: ReadableSpan,
  overrides: DetectedResourceAttributes,
): void {
  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === "string") {
      span.resource.attributes[key] = value
    }
  }
}
