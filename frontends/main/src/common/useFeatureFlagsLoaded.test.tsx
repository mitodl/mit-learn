import React from "react"
import { render, waitFor } from "@testing-library/react"
import { useFeatureFlagEnabled } from "posthog-js/react"
import ConfiguredPostHogProvider from "@/page-components/ConfiguredPostHogProvider/ConfiguredPostHogProvider"
import { FeatureFlags } from "./feature_flags"
import { useFeatureFlagsLoaded } from "./useFeatureFlagsLoaded"

type FlagState = { loaded: boolean; enabled: boolean | undefined }

/**
 * Renders under the real provider with no api key, so the hooks see the real,
 * never-initialized posthog-js client, as in local development. Every render
 * is recorded: a gate that reads "loaded" before the env flags are in place
 * would 403 on that render even if the final state is right.
 */
const setupFlagStates = (env: Record<string, string>) => {
  window.__ENV = env
  const states: FlagState[] = []
  const Probe = () => {
    states.push({
      loaded: useFeatureFlagsLoaded(),
      enabled: useFeatureFlagEnabled(FeatureFlags.B2BAnalyticsDashboard),
    })
    return null
  }
  render(
    <ConfiguredPostHogProvider>
      <Probe />
    </ConfiguredPostHogProvider>,
  )
  return states
}

describe("useFeatureFlagsLoaded without a PostHog api key", () => {
  afterEach(() => {
    delete window.__ENV
  })

  test.each([
    { value: "True", enabled: true },
    { value: "true", enabled: true },
    { value: "False", enabled: false },
    { value: "false", enabled: false },
  ])(
    "treats NEXT_PUBLIC_FEATURE_*=$value as a loaded, final $enabled",
    async ({ value, enabled }) => {
      const states = setupFlagStates({
        NEXT_PUBLIC_FEATURE_b2b_analytics_dashboard: value,
      })
      await waitFor(() => {
        expect(states.at(-1)).toEqual({ loaded: true, enabled })
      })
      const loadedStates = states.filter((state) => state.loaded)
      expect(loadedStates.every((state) => state.enabled === enabled)).toBe(
        true,
      )
    },
  )

  test("reports a flag with no env var as loaded and off", async () => {
    const states = setupFlagStates({})
    await waitFor(() => {
      expect(states.at(-1)).toEqual({ loaded: true, enabled: undefined })
    })
  })
})
