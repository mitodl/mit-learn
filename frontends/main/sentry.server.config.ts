// Added by @sentry/wizard
// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  release: process.env.NEXT_PUBLIC_VERSION,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENV,
  // Independently controls what fraction of OTEL-sampled spans Sentry reports
  // to its own backend. Set NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE in your
  // environment (same variable used by the client config). Defaults to 1 if
  // unset or invalid. This is separate from OTEL_TRACES_SAMPLER_ARG, which
  // controls the upstream OTEL sampling rate.
  tracesSampleRate: (() => {
    const rate = parseFloat(
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "",
    )
    return Number.isNaN(rate) ? 1 : Math.min(1, Math.max(0, rate))
  })(),

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Our custom NodeSDK manages the OpenTelemetry provider (see src/otel.ts).
  // Sentry receives spans via SentrySpanProcessor rather than its own provider.
  skipOpenTelemetrySetup: true,
})
