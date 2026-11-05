import { renderHook } from "@testing-library/react"
import ConfiguredPostHogProvider from "@/page-components/ConfiguredPostHogProvider/ConfiguredPostHogProvider"
import { FeatureFlags } from "./feature_flags"
import { useFeatureFlag } from "./useFeatureFlag"
import { useFeatureFlagsLoaded } from "./useFeatureFlagsLoaded"

/**
 * Renders under the real provider with no api key, so useFeatureFlag reads the
 * real, never-initialized posthog-js client, as in local development.
 */
const readFlagState = (env: Record<string, string>) => {
  window.__ENV = env
  return renderHook(
    () => ({
      loaded: useFeatureFlagsLoaded(),
      enabled: useFeatureFlag(FeatureFlags.B2BAnalyticsDashboard),
    }),
    { wrapper: ConfiguredPostHogProvider },
  ).result
}

describe("useFeatureFlagsLoaded without a PostHog api key", () => {
  afterEach(() => {
    delete window.__ENV
  })

  test.each([
    { value: "True", enabled: true },
    { value: "false", enabled: false },
  ])(
    "treats NEXT_PUBLIC_FEATURE_*=$value as a loaded, final $enabled",
    ({ value, enabled }) => {
      const flagState = readFlagState({
        NEXT_PUBLIC_FEATURE_b2b_analytics_dashboard: value,
      })
      expect(flagState.current).toEqual({ loaded: true, enabled })
    },
  )

  test("reports a flag with no env var as loaded and off", () => {
    const flagState = readFlagState({})
    expect(flagState.current).toEqual({ loaded: true, enabled: false })
  })
})
