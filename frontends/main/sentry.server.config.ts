// Added by @sentry/wizard
// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base"
import type { SpanProcessor } from "@opentelemetry/sdk-trace-base"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"

/**
 * Build the list of extra span processors injected into Sentry's OTEL provider.
 *
 * Sentry's own SentrySpanProcessor is always first in the chain (managed by
 * Sentry internally). These processors are appended after it, so they receive
 * every span that passes the OTEL sampler — independently of whether Sentry
 * chooses to report that span to its backend via beforeSendTransaction.
 *
 * LOCAL TESTING (no Grafana Alloy required):
 * Set OTEL_TRACES_EXPORTER=console and OTEL_TRACES_SAMPLER_ARG=1.0 to print
 * completed spans as JSON to stdout. See env/frontend.env for details.
 */
function buildSpanProcessors(): SpanProcessor[] {
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    // OTLPTraceExporter reads OTEL_EXPORTER_OTLP_ENDPOINT from env and appends
    // /v1/traces automatically.
    return [new BatchSpanProcessor(new OTLPTraceExporter())]
  }
  if (process.env.OTEL_TRACES_EXPORTER === "console") {
    return [new SimpleSpanProcessor(new ConsoleSpanExporter())]
  }
  return []
}

/**
 * Parse a sample rate from an environment variable.
 * Returns the default value when the variable is absent, empty, or not a
 * valid number in [0, 1].
 */
function parseSampleRate(
  value: string | undefined,
  defaultRate: number,
): number {
  const rate = parseFloat(value ?? "")
  return Number.isNaN(rate) ? defaultRate : Math.min(1, Math.max(0, rate))
}

// OTEL_TRACES_SAMPLER_ARG controls the OTEL sampler rate — i.e. what fraction
// of requests create spans at all. All sampled spans flow to both Sentry's
// internal processor AND the OTLP processor (→ Alloy/Tempo).
// Defaults to 1.0 (100%) so that Alloy receives every trace in production.
const otelSampleRate = parseSampleRate(process.env.OTEL_TRACES_SAMPLER_ARG, 1)

// NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE is a secondary, Sentry-only filter.
// Of the spans that reach Sentry's processor, only this fraction are actually
// sent to the Sentry backend. Defaults to 1.0 when unset.
// This lets you run Alloy at 100% while keeping Sentry costs/quota lower.
const sentrySampleRate = parseSampleRate(
  process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
  1,
)

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  release: process.env.NEXT_PUBLIC_VERSION,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENV,

  // Controls the OTEL sampler — spans not sampled here never reach any
  // processor. Set via OTEL_TRACES_SAMPLER_ARG at runtime (K8s/Helm).
  tracesSampleRate: otelSampleRate,

  // Inject our OTLP exporter (and console fallback) into Sentry's OTEL
  // provider. These processors run in parallel with Sentry's own
  // SentrySpanProcessor and are unaffected by beforeSendTransaction.
  openTelemetrySpanProcessors: buildSpanProcessors(),

  // Secondary Sentry-only downsampler: drop transactions before they are
  // sent to the Sentry backend, without affecting the OTLP/Alloy pipeline.
  // Controlled by NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE.
  beforeSendTransaction: (transaction) => {
    return Math.random() < sentrySampleRate ? transaction : null
  },

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
})
