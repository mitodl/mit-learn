import { isSpanContextValid, trace } from "@opentelemetry/api"
import type { IncomingMessage, ServerResponse } from "node:http"
import { env } from "@/env"

export type RequestLogEntry = {
  message: "next_request"
  method: string
  route: string
  query: string | null
  statusCode: number
  durationMs: number
  traceId: string | null
  spanId: string | null
  version: string | null
}

const APP_VERSION = env("NEXT_PUBLIC_VERSION") ?? null

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
  // Split the URL into path + query so the path can group cleanly while the
  // query stays available for filtering (e.g. _rsc=... marks an RSC fetch).
  const url = request.url ?? ""
  const queryIdx = url.indexOf("?")
  const route = queryIdx === -1 ? url : url.slice(0, queryIdx)
  const query = queryIdx === -1 ? null : url.slice(queryIdx + 1)
  return {
    message: "next_request",
    method: request.method ?? "UNKNOWN",
    route,
    query,
    statusCode: response.statusCode,
    durationMs,
    traceId: hasTrace && ctx ? ctx.traceId : null,
    spanId: hasTrace && ctx ? ctx.spanId : null,
    version: APP_VERSION,
  }
}
