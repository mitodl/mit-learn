import React from "react"
import { renderWithProviders, screen } from "@/test-utils"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { notFound } from "next/navigation"
import { allowConsoleErrors } from "ol-test-utilities"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import ArithmixClient from "./ArithmixClient"

jest.mock("mynumbers", () => ({
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
})
