import { isSpanContextValid, trace } from "@opentelemetry/api"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base"
import { envDetector } from "@opentelemetry/resources"
import type { DetectedResourceAttributes } from "@opentelemetry/resources"

export type RequestLogEntry = {
  message: "next_request"
  method: string
  route: string
  statusCode: number
  durationMs: number
  traceId: string | null
  spanId: string | null
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
 * Build a structured log entry for a finished HTTP request. The traceId/spanId
 * come from the active OTEL context if one is present — a null traceId in the
 * log is itself the diagnostic signal that the request was not traced.
 */
export function createRequestLogEntry({
  request,
  response,
  durationMs,
}: {
  request: IncomingMessage
  response: ServerResponse
  durationMs: number
}): RequestLogEntry {
  const ctx = trace.getActiveSpan()?.spanContext()
  const hasTrace = ctx ? isSpanContextValid(ctx) : false
  return {
    message: "next_request",
    method: request.method ?? "UNKNOWN",
    // Strip the query string so log routes group cleanly. We don't have access
    // to the matched Next.js route template here (e.g. /courses/[id]); raw
    // paths are good enough for "did every request get a trace" comparisons.
    route: request.url?.split("?")[0] ?? "",
    statusCode: response.statusCode,
    durationMs,
    traceId: hasTrace && ctx ? ctx.traceId : null,
    spanId: hasTrace && ctx ? ctx.spanId : null,
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
