import * as Sentry from "@sentry/nextjs"

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Validate env first (instrumentation-node calls validateEnv() at module
    // load and exits the process on failure). Running it before
    // bootstrapApiClients() ensures the guaranteed-exit check fires ahead of
    // bootstrap's requiredEnv() throw, which Next may otherwise swallow.
    await import("./instrumentation-node")
    const { bootstrapApiClients } = await import("./bootstrap/api")
    bootstrapApiClients()
  }
}

export const onRequestError = Sentry.captureRequestError
