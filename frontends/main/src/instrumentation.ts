import * as Sentry from "@sentry/nextjs"
import type { AxiosError } from "axios"

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

/**
 * Next's centralized hook for errors thrown during server-side rendering
 * (server components, route handlers, etc.). It does not fire for notFound()
 * or redirect(), which are control-flow signals rather than errors.
 *
 * When the underlying error is an Axios failure we tag the upstream status, so
 * an infrastructure/transient failure (5xx / network) can be told apart from a
 * genuine code error. captureRequestError forks its own scope internally; a tag
 * set on this outer scope is inherited by that fork and lands on the event.
 */
export const onRequestError: typeof Sentry.captureRequestError = (
  error,
  request,
  context,
) => {
  const axiosError = error as AxiosError
  if (axiosError?.isAxiosError) {
    Sentry.withScope((scope) => {
      scope.setTag(
        "ssr_fetch_status",
        String(axiosError.response?.status ?? "network"),
      )
      Sentry.captureRequestError(error, request, context)
    })
    return
  }
  Sentry.captureRequestError(error, request, context)
}
