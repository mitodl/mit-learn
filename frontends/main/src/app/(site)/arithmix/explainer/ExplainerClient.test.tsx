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
})
