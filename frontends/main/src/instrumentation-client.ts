import { env } from "./env"
// Client-side Sentry initialization.
//
// This file replaces sentry.client.config.ts, which relied on Sentry's webpack
// plugin to inject it into the bundle. Turbopack (default in Next.js 16) does
// not support that plugin, so we use the native instrumentation-client.ts hook
// instead. This file runs before React hydration on every page load.

import * as Sentry from "@sentry/nextjs"
import { bootstrapApiClients } from "./bootstrap/api"
import { parseSampleRate } from "./sentry-utils"

// This module evaluates before React hydration. A throw here aborts the
// entire client runtime and leaves the page blank, so nothing below may
// escape uncaught.
try {
  Sentry.init({
    dsn: env("NEXT_PUBLIC_SENTRY_DSN"),
    release: env("NEXT_PUBLIC_VERSION"),
    environment: env("NEXT_PUBLIC_SENTRY_ENV"),
    profilesSampleRate: parseSampleRate(
      env("NEXT_PUBLIC_SENTRY_PROFILES_SAMPLE_RATE"),
      0,
    ),
    tracesSampleRate: parseSampleRate(
      env("NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE"),
      1,
    ),
    tracePropagationTargets: [
      env("NEXT_PUBLIC_MITOL_API_BASE_URL"),
      env("NEXT_PUBLIC_MITX_ONLINE_BASE_URL"),
    ].filter((url) => url !== undefined),
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.browserProfilingIntegration(),
    ],
  })

  // Runs after Sentry.init so a failure here is captured rather than lost.
  // If it does fail, getQueryClient() retries at first render
  // (bootstrapApiClients is first-wins and re-callable).
  bootstrapApiClients()
} catch (error) {
  console.error("Client bootstrap failed:", error)
  Sentry.captureException(error)
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
