import posthog from "posthog-js"
import { createContext, useContext, useSyncExternalStore } from "react"
import { flagDefault, flagFallback } from "./feature_flags"
import type { FeatureFlags, ServerFlags } from "./feature_flags"

/**
 * The flag values the Next.js server evaluated for this document. Empty
 * outside a provider.
 */
const ServerFlagsContext = createContext<ServerFlags>({})

/**
 * Whether PostHog evaluated every flag in the flag load for the identity this
 * page currently has. ConfiguredPostHogProvider sets it. It is `false` while
 * that load is pending and when it fails, times out, is blocked or is skipped.
 */
const FlagsSuccessContext = createContext(false)

const subscribe = (onChange: () => void) => posthog.onFeatureFlags(onChange)

/**
 * Whether a feature flag is on.
 *
 * During SSR and hydration the flag reads the server's value when the server
 * has one, and its env default when it has none, so the server and first
 * client render agree. After that, it reads PostHog's value when PostHog has
 * one, from this load's /flags or stored in this browser on an earlier visit.
 *
 * When PostHog has none, what it reads depends on whether PostHog has answered:
 * - Before it answers, and when the request fails or is blocked: the server's
 *   value, then the env default.
 * - Once it has evaluated every flag for this visitor: the env default. The
 *   flag is one PostHog doesn't return (disabled, deleted, never created, or
 *   not evaluated in the browser), and the server's value can be older than
 *   that answer: a cached page keeps the value it was rendered with.
 *
 * The server's value comes from `ServerFlagsContext`. It is what the server
 * evaluated for one fixed server id, so it doesn't reflect a visitor's
 * rollout bucket or person properties. A flag has no entry there when it is
 * disabled in PostHog, absent from PostHog, or not evaluable locally, and the
 * whole object is empty when the server has no secret key, has not loaded
 * definitions, or evaluation fails.
 *
 * So disabling a flag in PostHog hands it back to its env default, on the
 * server and in the browser. To switch a flag off, roll it out to 0%: PostHog
 * returns that as off.
 *
 * Set a flag's env default to what PostHog gives an anonymous visitor, so the
 * page doesn't change when PostHog answers.
 *
 * This doesn't use posthog-js/react's `useFeatureFlagEnabled`: it takes its
 * first value from posthog-js during render, with nothing separate for the
 * server render. A component that hydrates after posthog-js has flags, such as
 * one inside a `<Suspense>` boundary that streams in late, then renders
 * PostHog's value where the server rendered its own, and React throws away and
 * re-renders that part of the page. Passing the fallback as its `defaultValue`
 * doesn't help: that applies only while posthog-js has no value.
 * `useSyncExternalStore` renders the server's value while hydrating, then
 * switches to PostHog's.
 */
const useFeatureFlag = (flag: FeatureFlags): boolean => {
  const serverFlags = useContext(ServerFlagsContext)
  const flagsSuccess = useContext(FlagsSuccessContext)
  const fallback = flagFallback(flag, serverFlags)
  const unreturned = flagsSuccess ? flagDefault(flag) : fallback
  return useSyncExternalStore(
    subscribe,
    () => posthog.isFeatureEnabled(flag) ?? unreturned,
    () => fallback,
  )
}

export { ServerFlagsContext, FlagsSuccessContext, useFeatureFlag }
