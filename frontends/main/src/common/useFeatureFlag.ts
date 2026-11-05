import posthog from "posthog-js"
import { useSyncExternalStore } from "react"
import { env, fullEnv } from "@/env"
import type { FeatureFlags } from "./feature_flags"

/**
 * The flag's env default: `NEXT_PUBLIC_FEATURE_<flag>`, with dashes in the
 * flag key read as underscores in the env var name. Only "true" (any case) is
 * on; anything else, including unset, is off.
 */
const flagDefault = (flag: FeatureFlags): boolean => {
  const prefix = env("NEXT_PUBLIC_POSTHOG_FEATURE_PREFIX") ?? "FEATURE_"
  /**
   * fullEnv(), not env(): these keys are built at runtime, and env() only
   * accepts the keys declared in the env schema.
   */
  const value = fullEnv()[`NEXT_PUBLIC_${prefix}${flag.replaceAll("-", "_")}`]
  return value?.toLowerCase() === "true"
}

const subscribe = (onChange: () => void) => posthog.onFeatureFlags(onChange)

/**
 * Whether a feature flag is on.
 *
 * During SSR and hydration the flag reads its env default, so the server and
 * first client render agree. After that, it reads PostHog's value when PostHog
 * has one, from this load's /flags or stored in this browser on an earlier
 * visit, and its env default when PostHog has none: before PostHog answers,
 * when the request fails, and for a flag PostHog doesn't return (disabled,
 * deleted, never created, or not evaluated in the browser).
 *
 * So disabling a flag in PostHog hands it back to its env default. To switch a
 * flag off, roll it out to 0%: PostHog returns that as off.
 *
 * Set a flag's env default to what PostHog gives an anonymous visitor, so the
 * page doesn't change when PostHog answers.
 *
 * This doesn't use posthog-js/react's `useFeatureFlagEnabled`: it takes its
 * first value from posthog-js during render, with nothing separate for the
 * server render. A component that hydrates after posthog-js has flags, such as
 * one inside a `<Suspense>` boundary that streams in late, then renders
 * PostHog's value where the server rendered the env default, and React throws
 * away and re-renders that part of the page. Passing the env default as its
 * `defaultValue` doesn't help: that applies only while posthog-js has no value.
 * `useSyncExternalStore` renders the server's value while hydrating, then
 * switches to PostHog's.
 */
const useFeatureFlag = (flag: FeatureFlags): boolean =>
  useSyncExternalStore(
    subscribe,
    () => posthog.isFeatureEnabled(flag) ?? flagDefault(flag),
    () => flagDefault(flag),
  )

export { useFeatureFlag }
