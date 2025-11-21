import { INTERNAL_BOOTSTRAPPING_FLAG } from "@/common/feature_flags"
import { useFeatureFlagEnabled, usePostHog } from "posthog-js/react"
import { useEffect, useState } from "react"

/**
 * Returns `true` if feature flags have been loaded via posthog API, else `false`.
 *
 * NOTES:
 * 1. Avoid using this! Really!:
 *   - This can delay feature flag availability for users who have been to the
 *     site before. Their flags will be bootstrapped from localStorage, and should
 *     have the correct values immediately, before contacting the PostHog server.
 *   - We generally shouldn't care if a flag is "false" or
 *     "not loaded yet".
 *
 *     USE CASE: One case where this distinction matters is when an entire page
 *     is behind a feature flag, and we don't want to 404 until the flags are
 *     loaded.
 * 2. Unlike posthog's `onFeatureFlags` callback, this hook enables you to
 *   distinguish between bootstrapped flags and flags loaded from PostHog server.
 */
const useFeatureFlagsLoaded = () => {
  const posthog = usePostHog()
  const [hasBootstrapped, setHasBootstrapped] = useState(false)
  useEffect(() => {
    return posthog.onFeatureFlags(() => {
      setHasBootstrapped(true)
    })
  }, [posthog])
  const bootstrapFlag = useFeatureFlagEnabled(INTERNAL_BOOTSTRAPPING_FLAG)
  /**
   * bootstrapFlag will be undefined:
   *  1. BEFORE posthog has initialized (nothing bootstrapped yet)
   *  2. AFTER posthog has loaded flags from its server.
   */
  return hasBootstrapped && bootstrapFlag === undefined
}

export { useFeatureFlagsLoaded }
