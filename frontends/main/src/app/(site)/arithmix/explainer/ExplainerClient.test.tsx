import React from "react"
import { renderWithProviders, screen } from "@/test-utils"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { notFound } from "next/navigation"
import { allowConsoleErrors } from "ol-test-utilities"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import ExplainerClient from "./ExplainerClient"

jest.mock("mynumbers", () => ({
  __esModule: true,
  ExplainerPage: () => <div data-testid="explainer">Arithmix Explainer</div>,
}))

jest.mock("@/common/useFeatureFlagsLoaded", () => ({
  useFeatureFlagsLoaded: jest.fn(),
}))

jest.mock("posthog-js/react")

const mockUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)
const mockUseFeatureFlagsLoaded = jest.mocked(useFeatureFlagsLoaded)
const mockNotFound = jest.mocked(notFound)

describe("ExplainerClient", () => {
  test("renders the ExplainerPage when the feature flag is enabled", async () => {
    mockUseFeatureFlagsLoaded.mockReturnValue(true)
    mockUseFeatureFlagEnabled.mockReturnValue(true)
    renderWithProviders(<ExplainerClient />)
    expect(await screen.findByTestId("explainer")).toBeInTheDocument()
  })

  test("renders nothing while the feature flags have not loaded", () => {
    mockUseFeatureFlagsLoaded.mockReturnValue(false)
    mockUseFeatureFlagEnabled.mockReturnValue(undefined)
    renderWithProviders(<ExplainerClient />)
    expect(screen.queryByTestId("explainer")).not.toBeInTheDocument()
    expect(mockNotFound).not.toHaveBeenCalled()
  })

  test("calls notFound when the flag is disabled and flags have loaded", () => {
    allowConsoleErrors()
    mockNotFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND")
    })
    mockUseFeatureFlagsLoaded.mockReturnValue(true)
    mockUseFeatureFlagEnabled.mockReturnValue(false)
    expect(() => renderWithProviders(<ExplainerClient />)).toThrow(
      "NEXT_NOT_FOUND",
    )
    expect(mockNotFound).toHaveBeenCalled()
  })

  test("calls notFound when the mynumbers package fails to load", async () => {
    allowConsoleErrors()
    mockNotFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND")
    })

    jest.doMock("mynumbers", () => ({
      __esModule: true,
      get ExplainerPage() {
        throw new Error("Failed to load dynamically imported module")
      },
    }))
    jest.doMock("posthog-js/react", () => ({
      useFeatureFlagEnabled: () => true,
    }))
    jest.doMock("@/common/useFeatureFlagsLoaded", () => ({
      useFeatureFlagsLoaded: () => true,
    }))

    await jest.isolateModulesAsync(async () => {
      // Disable Testing Library's auto-cleanup so importing it here does not
      // register an `afterEach` hook (hooks cannot be defined inside a test).
      // Import `@testing-library/react` directly rather than `@/test-utils`,
      // which also pulls in `user-event` and registers an `afterAll` hook.
      process.env.RTL_SKIP_AUTO_CLEANUP = "true"
      const { render, act: isolatedAct } = await import(
        "@testing-library/react"
      )
      delete process.env.RTL_SKIP_AUTO_CLEANUP

      const { default: ExplainerClientWithFailedImport } = await import(
        "./ExplainerClient"
      )

      await expect(
        isolatedAct(async () => {
          render(<ExplainerClientWithFailedImport />)
          await new Promise((resolve) => setTimeout(resolve, 0))
        }),
      ).rejects.toThrow("NEXT_NOT_FOUND")
    })
  })
})
