import React from "react"
import { render, screen } from "@testing-library/react"
import { useFeatureFlagEnabled } from "posthog-js/react"
import ConfiguredPostHogProvider from "@/page-components/ConfiguredPostHogProvider/ConfiguredPostHogProvider"
import { FeatureFlags } from "./feature_flags"
import { useFeatureFlagsLoaded } from "./useFeatureFlagsLoaded"

const FlagState = () => {
  const loaded = useFeatureFlagsLoaded()
  const enabled = useFeatureFlagEnabled(FeatureFlags.B2BAnalyticsDashboard)
  return <div>{`loaded=${loaded} enabled=${enabled}`}</div>
}

/**
 * No api key, so the real, never-initialized posthog-js client is what the
 * hooks see, as in local development.
 */
describe("useFeatureFlagsLoaded without a PostHog api key", () => {
  afterEach(() => {
    delete window.__ENV
  })

  test("treats the env flags as loaded, final values", async () => {
    window.__ENV = { NEXT_PUBLIC_FEATURE_b2b_analytics_dashboard: "True" }
    render(
      <ConfiguredPostHogProvider>
        <FlagState />
      </ConfiguredPostHogProvider>,
    )
    await screen.findByText("loaded=true enabled=true")
  })

  test("reports a flag with no env var as loaded and off", async () => {
    window.__ENV = {}
    render(
      <ConfiguredPostHogProvider>
        <FlagState />
      </ConfiguredPostHogProvider>,
    )
    await screen.findByText("loaded=true enabled=undefined")
  })
})
