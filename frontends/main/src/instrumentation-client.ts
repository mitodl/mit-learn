// Client-side Sentry initialization.
//
// This file replaces sentry.client.config.ts, which relied on Sentry's webpack
// plugin to inject it into the bundle. Turbopack (default in Next.js 16) does
// not support that plugin, so we use the native instrumentation-client.ts hook
// instead. This file runs before React hydration on every page load.

import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  release: process.env.NEXT_PUBLIC_VERSION,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENV,
  profilesSampleRate: Number(
    process.env.NEXT_PUBLIC_SENTRY_PROFILES_SAMPLE_RATE,
  ),
  tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE),
  tracePropagationTargets: [
    process.env.NEXT_PUBLIC_MITOL_API_BASE_URL,
    process.env.NEXT_PUBLIC_MITX_ONLINE_BASE_URL,
  ].filter((url) => url !== undefined),
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.browserProfilingIntegration(),
  ],
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
