/**
 * OpenTelemetry SDK setup for the Next.js server runtime.
 *
 * This module is imported by instrumentation.ts in the "nodejs" runtime block,
 * before Sentry is initialised. Sentry is configured with
 * `skipOpenTelemetrySetup: true` so that it does not create its own OTEL
 * provider — instead, SentrySpanProcessor forwards spans from this SDK to
 * Sentry.
 *
 * Traces are exported via OTLP/HTTP to Grafana Alloy, which forwards them to
 * Grafana Tempo. Configure the following runtime environment variables (these
 * are read automatically by the OTEL SDK; they do NOT need a NEXT_PUBLIC_
 * prefix because they are server-side only):
 *
 *   OTEL_SERVICE_NAME              e.g. "mit-learn-frontend"
 *   OTEL_EXPORTER_OTLP_ENDPOINT    e.g. "http://alloy.monitoring:4318"
 *   OTEL_TRACES_SAMPLER            e.g. "parentbased_traceidratio"
 *   OTEL_TRACES_SAMPLER_ARG        e.g. "1.0"  (0.0 disables sampling)
 *
 * When OTEL_EXPORTER_OTLP_ENDPOINT is not set, traces are not exported to
 * Alloy/Tempo but Sentry still receives spans via SentrySpanProcessor.
 *
 * LOCAL TESTING (no Alloy required):
 * Set OTEL_TRACES_EXPORTER=console and OTEL_TRACES_SAMPLER_ARG=1.0 to print
 * spans as JSON to stdout. Each span includes its trace ID, name, duration,
 * attributes, and status — useful for verifying instrumentation without a
 * running collector. See env/frontend.env for a ready-to-uncomment block.
 */
import { NodeSDK } from "@opentelemetry/sdk-node"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base"
import type { SpanProcessor } from "@opentelemetry/sdk-trace-base"
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node"
import {
  CompositePropagator,
  W3CTraceContextPropagator,
  W3CBaggagePropagator,
} from "@opentelemetry/core"
import { SentrySpanProcessor, SentryPropagator } from "@sentry/opentelemetry"

// Guard against duplicate initialisation in dev/HMR environments where modules
// can be re-evaluated across worker restarts. The SDK and SIGTERM handler must
// only be registered once per process.
const globalWithOtel = globalThis as typeof globalThis & {
  __OTEL_NODE_SDK__?: NodeSDK
}

if (!globalWithOtel.__OTEL_NODE_SDK__) {
  const spanProcessors: SpanProcessor[] = [
    // Forward spans to Sentry (required because Sentry.init uses skipOpenTelemetrySetup: true)
    new SentrySpanProcessor(),
  ]

  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    // OTLPTraceExporter automatically appends /v1/traces to OTEL_EXPORTER_OTLP_ENDPOINT
    spanProcessors.push(new BatchSpanProcessor(new OTLPTraceExporter()))
  } else if (process.env.OTEL_TRACES_EXPORTER === "console") {
    // Local development: print completed spans as JSON to stdout.
    // Enable with: OTEL_TRACES_EXPORTER=console OTEL_TRACES_SAMPLER_ARG=1.0
    spanProcessors.push(new SimpleSpanProcessor(new ConsoleSpanExporter()))
  }

  const sdk = new NodeSDK({
    spanProcessors,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable fs instrumentation — it generates very high span volume with little
        // diagnostic value and can significantly slow down the application.
        "@opentelemetry/instrumentation-fs": { enabled: false },
      }),
    ],
    textMapPropagator: new CompositePropagator({
      propagators: [
        // W3C Trace Context: injects/extracts traceparent and tracestate headers
        // on all outgoing HTTP requests (axios, fetch) for distributed tracing.
        new W3CTraceContextPropagator(),
        new W3CBaggagePropagator(),
        // Sentry's propagator handles Sentry-specific baggage (DSC)
        new SentryPropagator(),
      ],
    }),
  })

  // Awaiting sdk.start() ensures the module fully evaluates (and propagators/
  // processors are registered) before instrumentation.ts proceeds to init Sentry.
  // start() is currently synchronous (returns void) but awaiting is future-proof.
  await sdk.start()

  process.once("SIGTERM", () => {
    sdk.shutdown().catch(console.error)
  })

  globalWithOtel.__OTEL_NODE_SDK__ = sdk
}
