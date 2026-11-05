import React from "react"
import { act, renderHook } from "@testing-library/react"
import { hydrateRoot } from "react-dom/client"
// jsdom resolves react-dom/server to its browser build, which needs MessageChannel.
import { renderToString } from "react-dom/server.node"
import posthog from "posthog-js"
import { FeatureFlags } from "./feature_flags"
import { useFeatureFlag } from "./useFeatureFlag"

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: {
    isFeatureEnabled: jest.fn(),
    onFeatureFlags: jest.fn(),
  },
}))
const mockIsFeatureEnabled = jest.mocked(posthog.isFeatureEnabled)
const mockOnFeatureFlags = jest.mocked(posthog.onFeatureFlags)

describe("useFeatureFlag", () => {
  beforeEach(() => {
    mockOnFeatureFlags.mockReturnValue(() => {})
  })
  afterEach(() => {
    delete window.__ENV
  })

  test("PostHog's value wins over the env default", () => {
    window.__ENV = { NEXT_PUBLIC_FEATURE_universal_ai: "true" }
    mockIsFeatureEnabled.mockReturnValue(false)
    const { result } = renderHook(() =>
      useFeatureFlag(FeatureFlags.UniversalAI),
    )
    expect(result.current).toBe(false)
  })

  test("A flag PostHog has no value for reads its env default", () => {
    window.__ENV = { NEXT_PUBLIC_FEATURE_universal_ai: "true" }
    mockIsFeatureEnabled.mockReturnValue(undefined)
    const { result } = renderHook(() =>
      useFeatureFlag(FeatureFlags.UniversalAI),
    )
    expect(result.current).toBe(true)
  })

  test("Reads the env default under NEXT_PUBLIC_POSTHOG_FEATURE_PREFIX", () => {
    window.__ENV = {
      NEXT_PUBLIC_POSTHOG_FEATURE_PREFIX: "FLAG_",
      NEXT_PUBLIC_FLAG_universal_ai: "true",
    }
    mockIsFeatureEnabled.mockReturnValue(undefined)
    const { result } = renderHook(() =>
      useFeatureFlag(FeatureFlags.UniversalAI),
    )
    expect(result.current).toBe(true)
  })

  test("Updates when PostHog's flags change", () => {
    mockIsFeatureEnabled.mockReturnValue(undefined)
    const { result } = renderHook(() =>
      useFeatureFlag(FeatureFlags.UniversalAI),
    )
    expect(result.current).toBe(false)
    mockIsFeatureEnabled.mockReturnValue(true)
    act(() => mockOnFeatureFlags.mock.calls[0][0]([], {}))
    expect(result.current).toBe(true)
  })

  test("Hydrates with the env default when PostHog already has a value, then switches to it", async () => {
    const Flag = () => (
      <span>{String(useFeatureFlag(FeatureFlags.UniversalAI))}</span>
    )
    mockIsFeatureEnabled.mockReturnValue(undefined)
    const container = document.createElement("div")
    container.innerHTML = renderToString(<Flag />)
    expect(container.textContent).toBe("false")

    mockIsFeatureEnabled.mockReturnValue(true)
    const onRecoverableError = jest.fn()
    await act(async () => {
      hydrateRoot(container, <Flag />, { onRecoverableError })
    })
    expect(onRecoverableError).not.toHaveBeenCalled()
    expect(container.textContent).toBe("true")
  })
})
