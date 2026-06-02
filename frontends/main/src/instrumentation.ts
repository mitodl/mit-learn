import * as Sentry from "@sentry/nextjs"

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { bootstrapApiClients } = await import("./bootstrap/api")
    bootstrapApiClients()
    await import("./instrumentation-node")
  }
}

export const onRequestError = Sentry.captureRequestError
