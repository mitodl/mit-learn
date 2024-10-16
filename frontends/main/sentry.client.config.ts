// Added by @sentry/wizard
// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  release: process.env.NEXT_PUBLIC_VERSION,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENV,
  profilesSampleRate: Number(
    process.env.NEXT_PUBLIC_SENTRY_PROFILES_SAMPLE_RATE,
  ),
  tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE),
  tracePropagationTargets: process.env.NEXT_PUBLIC_MITOL_API_BASE_URL
    ? [process.env.NEXT_PUBLIC_MITOL_API_BASE_URL]
    : [],
  // Add optional integrations for additional features
  integrations: [
    Sentry.replayIntegration(),
    Sentry.browserTracingIntegration(),
    Sentry.browserProfilingIntegration(),
  ],

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,
})
