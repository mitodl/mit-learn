// Added by @sentry/wizard
import * as Sentry from "@sentry/nextjs"

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // OTEL must be initialised before Sentry. Sentry is configured with
    // skipOpenTelemetrySetup: true so it relies on our NodeSDK rather than
    // creating its own OpenTelemetry provider.
    await import("./otel")
    await import("../sentry.server.config")
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config")
  }
}

export const onRequestError = Sentry.captureRequestError
