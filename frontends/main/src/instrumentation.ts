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
    // Next awaits register() before the server takes requests, so loading
    // flag definitions here keeps a new pod's first renders from being cached
    // by the CDN with env defaults. Nothing depends on this having run: a
    // cold getServerFlags() call does the same bounded wait.
    const { getServerFlags } = await import("./common/serverFeatureFlags")
    await getServerFlags()
  }
}

export const onRequestError = Sentry.captureRequestError
