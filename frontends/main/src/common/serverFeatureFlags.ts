/**
 * Server-side PostHog flag evaluation for the Next.js server. Server-only: it
 * reads a secret key, so no "use client" module may import it.
 *
 * - The `posthog-node` client lives on `globalThis`. `instrumentation.ts` and
 *   the server components can be separate module instances within one process,
 *   so a module-level variable would give each its own client and poller. It
 *   also keeps dev hot-reload from stacking pollers.
 * - Calls made while the process's one wait is pending wait with it, so a
 *   page rendered right after startup is not cached by the CDN with env
 *   defaults. `instrumentation.ts` calls `getServerFlags()` at startup to warm
 *   the client, but correctness does not depend on that: a cold first call
 *   does the same bounded wait.
 * - The wait happens once per process, not per request. Until definitions
 *   load, a wait made on every request would run its full 3-second timeout
 *   each time, and a PostHog outage can outlast many polling intervals. The
 *   poller keeps retrying in the background, and evaluation starts as soon as
 *   it succeeds.
 * - A failed poll leaves the last loaded definitions in place, so a pod that
 *   has them keeps evaluating through a PostHog outage. Only a 402 (flag
 *   quota exceeded) clears them.
 */
import { cache } from "react"
import { PostHog } from "posthog-node"
import { env } from "@/env"
import { FeatureFlags } from "./feature_flags"
import type { ServerFlags } from "./feature_flags"

declare global {
  // eslint-disable-next-line no-var
  var __MIT_LEARN_SERVER_FLAGS__:
    { client: PostHog; ready: Promise<boolean> } | undefined
}

const DEFINITIONS_WAIT_MS = 3000
const POLLING_INTERVAL_MS = 300_000
const DISTINCT_ID = "mit-learn-nextjs-server"

const getHolder = (apiKey: string, secretKey: string) => {
  if (globalThis.__MIT_LEARN_SERVER_FLAGS__) {
    return globalThis.__MIT_LEARN_SERVER_FLAGS__
  }
  const client = new PostHog(apiKey, {
    host: env("NEXT_PUBLIC_POSTHOG_API_HOST"),
    secretKey,
    featureFlagsPollingInterval: POLLING_INTERVAL_MS,
  })
  client.on("error", (error: unknown) => {
    console.error("[posthog-node]", error)
  })
  const ready = client
    .waitForLocalEvaluationReady(DEFINITIONS_WAIT_MS)
    .then((loaded) => {
      if (loaded) {
        console.info("[posthog-node] Flag definitions loaded")
      } else {
        console.warn(
          "[posthog-node] No flag definitions loaded within 3 seconds; the server renders env defaults until some load",
        )
      }
      return loaded
    })
  globalThis.__MIT_LEARN_SERVER_FLAGS__ = { client, ready }
  return globalThis.__MIT_LEARN_SERVER_FLAGS__
}

const evaluateServerFlags = async (): Promise<ServerFlags> => {
  const apiKey = env("NEXT_PUBLIC_POSTHOG_API_KEY")
  const secretKey = process.env.POSTHOG_SECRET_KEY
  if (!apiKey || !secretKey) return {}
  try {
    const { client, ready } = getHolder(apiKey, secretKey)
    await ready
    if (!client.isLocalEvaluationReady()) return {}
    const keys = Object.values(FeatureFlags)
    const results = await Promise.all(
      keys.map((key) =>
        client.getFeatureFlagResult(key, DISTINCT_ID, {
          onlyEvaluateLocally: true,
          // Without this, each evaluation queues a `$feature_flag_called` event.
          sendFeatureFlagEvents: false,
        }),
      ),
    )
    const flags: ServerFlags = {}
    keys.forEach((key, i) => {
      const result = results[i]
      // PostHog's `/flags` response omits a disabled flag, so the posthog-js
      // client has no value for it and reads the env default. Local evaluation
      // reports it as off; leaving it out keeps the two in agreement.
      if (result && result.reasonCode !== "flag_disabled") {
        flags[key] = result.enabled
      }
    })
    return flags
  } catch (error) {
    console.error("[posthog-node] Server flag evaluation failed", error)
    return {}
  }
}

/** Flags PostHog evaluated for the server, or `{}` when it cannot. Never rejects. */
export const getServerFlags = cache(evaluateServerFlags)
