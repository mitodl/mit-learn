/**
 * Server-side PostHog flag evaluation for the Next.js server. Server-only: it
 * reads a secret key, so no "use client" module may import it.
 *
 * - Calls made while the process's one wait is pending wait with it, so a
 *   page rendered right after startup is not cached by the CDN with env
 *   defaults. `instrumentation.ts` calls `getServerFlags()` at startup to warm
 *   the client, but correctness does not depend on that: a cold first call
 *   does the same bounded wait.
 * - The wait happens once per process, not per request. Until definitions
 *   load, a wait made on every request would run its full timeout each time,
 *   and a PostHog outage can outlast many polling intervals. The
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

type Holder = { client: PostHog; ready: Promise<boolean> }

declare global {
  // eslint-disable-next-line no-var
  var __MIT_LEARN_SERVER_FLAGS__: Holder | undefined
}

/**
 * `validateEnv` rejects a non-numeric value at startup; unset, empty and 0
 * read as the fallback.
 */
const msFromEnv = (name: string, fallback: number): number =>
  Number(process.env[name]) || fallback

const definitionsWaitMs = () => msFromEnv("POSTHOG_SERVER_FLAGS_WAIT_MS", 3000)
const pollingIntervalMs = () =>
  msFromEnv("POSTHOG_SERVER_FLAGS_POLLING_INTERVAL_MS", 300_000)
/**
 * The one id every flag is evaluated for. A percentage rollout hashes it, and
 * `posthog-node` matches a condition on the `distinct_id` property against it.
 * A flag in PostHog can name it in its conditions to pin the server's value
 * (see the README), so changing it changes what such a flag renders.
 */
const SERVER_DISTINCT_ID = "mit-learn-nextjs-server"

/**
 * The process's one `posthog-node` client and its definitions wait, created on
 * first use and kept on `globalThis`.
 *
 * Next.js bundles `instrumentation.ts` and the server render as separate
 * module graphs that each evaluate this file. A module-level variable would
 * give each graph its own client and poller, and the client warmed at startup
 * would not be the one that renders pages. Dev hot-reload re-evaluates the
 * file too, and would add a poller each time. `globalSingleton` in
 * `frontends/api/src/configurableAxios.ts` explains the module graphs.
 */
const getHolder = (apiKey: string, secretKey: string): Holder => {
  if (globalThis.__MIT_LEARN_SERVER_FLAGS__) {
    return globalThis.__MIT_LEARN_SERVER_FLAGS__
  }
  const client = new PostHog(apiKey, {
    host: env("NEXT_PUBLIC_POSTHOG_API_HOST"),
    secretKey,
    featureFlagsPollingInterval: pollingIntervalMs(),
  })
  client.on("error", (error: unknown) => {
    console.error("[posthog-node]", error)
  })
  const waitMs = definitionsWaitMs()
  const ready = client.waitForLocalEvaluationReady(waitMs).then((loaded) => {
    if (loaded) {
      console.info("[posthog-node] Flag definitions loaded")
    } else {
      console.warn(
        `[posthog-node] No flag definitions loaded within ${waitMs} ms; the server renders env defaults until some load`,
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
        client.getFeatureFlagResult(key, SERVER_DISTINCT_ID, {
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
