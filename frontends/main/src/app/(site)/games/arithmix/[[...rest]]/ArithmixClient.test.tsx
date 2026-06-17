import React from "react"
import { renderWithProviders, screen } from "@/test-utils"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { notFound } from "next/navigation"
import { allowConsoleErrors } from "ol-test-utilities"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import ArithmixClient from "./ArithmixClient"

jest.mock("@mitodl/arithmix", () => ({
  __esModule: true,
  Arithmix: () => <div data-testid="arithmix">Arithmix Game</div>,
}))

jest.mock("@/common/useFeatureFlagsLoaded", () => ({
  useFeatureFlagsLoaded: jest.fn(),
}))

jest.mock("posthog-js/react")

const mockUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)
const mockUseFeatureFlagsLoaded = jest.mocked(useFeatureFlagsLoaded)
const mockNotFound = jest.mocked(notFound)

describe("ArithmixClient", () => {
  test("renders the Arithmix component when the feature flag is enabled", async () => {
    mockUseFeatureFlagsLoaded.mockReturnValue(true)
    mockUseFeatureFlagEnabled.mockReturnValue(true)
    renderWithProviders(<ArithmixClient />)
    expect(await screen.findByTestId("arithmix")).toBeInTheDocument()
  })

  test("renders nothing while the feature flag is loading", () => {
    mockUseFeatureFlagsLoaded.mockReturnValue(false)
    mockUseFeatureFlagEnabled.mockReturnValue(undefined)
    renderWithProviders(<ArithmixClient />)
    expect(screen.queryByTestId("arithmix")).not.toBeInTheDocument()
    expect(mockNotFound).not.toHaveBeenCalled()
  })

  test("calls notFound when the feature flag is disabled", () => {
    allowConsoleErrors()
    mockNotFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND")
    })
    mockUseFeatureFlagsLoaded.mockReturnValue(true)
    mockUseFeatureFlagEnabled.mockReturnValue(false)
    expect(() => renderWithProviders(<ArithmixClient />)).toThrow(
      "NEXT_NOT_FOUND",
    )
    expect(mockNotFound).toHaveBeenCalled()
  })

  test("calls notFound when the mynumbers package fails to load", async () => {
    allowConsoleErrors()
    mockNotFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND")
    })

    jest.doMock("@mitodl/arithmix", () => ({
      __esModule: true,
      get Arithmix() {
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

      const { default: ArithmixClientWithFailedImport } = await import(
        "./ArithmixClient"
      )

      await expect(
        isolatedAct(async () => {
          render(<ArithmixClientWithFailedImport />)
          await new Promise((resolve) => setTimeout(resolve, 0))
        }),
      ).rejects.toThrow("NEXT_NOT_FOUND")
    })
  })
})
