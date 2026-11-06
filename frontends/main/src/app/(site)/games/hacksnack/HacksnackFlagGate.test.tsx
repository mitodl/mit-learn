import React from "react"
import { renderWithProviders, screen } from "@/test-utils"
import { useFeatureFlag } from "@/common/useFeatureFlag"
import { notFound } from "next/navigation"
import { allowConsoleErrors } from "ol-test-utilities"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import HacksnackFlagGate from "./HacksnackFlagGate"

jest.mock("@/common/useFeatureFlagsLoaded", () => ({
  useFeatureFlagsLoaded: jest.fn(),
}))

jest.mock("@/common/useFeatureFlag")

const mockUseFeatureFlag = jest.mocked(useFeatureFlag)
const mockUseFeatureFlagsLoaded = jest.mocked(useFeatureFlagsLoaded)
const mockNotFound = jest.mocked(notFound)

describe("HacksnackFlagGate", () => {
  test("renders children when the feature flag is enabled", () => {
    mockUseFeatureFlagsLoaded.mockReturnValue(true)
    mockUseFeatureFlag.mockReturnValue(true)
    renderWithProviders(
      <HacksnackFlagGate>
        <div data-testid="gated-content">Gated content</div>
      </HacksnackFlagGate>,
    )
    expect(screen.getByTestId("gated-content")).toBeInTheDocument()
    expect(mockNotFound).not.toHaveBeenCalled()
  })

  test("renders nothing while the feature flags have not loaded", () => {
    mockUseFeatureFlagsLoaded.mockReturnValue(false)
    mockUseFeatureFlag.mockReturnValue(false)
    renderWithProviders(
      <HacksnackFlagGate>
        <div data-testid="gated-content">Gated content</div>
      </HacksnackFlagGate>,
    )
    expect(screen.queryByTestId("gated-content")).not.toBeInTheDocument()
    expect(mockNotFound).not.toHaveBeenCalled()
  })

  test("calls notFound when the flag is disabled and flags have loaded", () => {
    allowConsoleErrors()
    mockNotFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND")
    })
    mockUseFeatureFlagsLoaded.mockReturnValue(true)
    mockUseFeatureFlag.mockReturnValue(false)
    expect(() =>
      renderWithProviders(
        <HacksnackFlagGate>
          <div data-testid="gated-content">Gated content</div>
        </HacksnackFlagGate>,
      ),
    ).toThrow("NEXT_NOT_FOUND")
    expect(mockNotFound).toHaveBeenCalled()
    expect(screen.queryByTestId("gated-content")).not.toBeInTheDocument()
  })
})
