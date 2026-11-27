import React from "react"
import { renderWithProviders, screen } from "@/test-utils"
import { useFeatureFlag } from "@/common/useFeatureFlag"
import { notFound } from "next/navigation"
import { allowConsoleErrors } from "ol-test-utilities"
import { useFeatureFlagsSettled } from "@/common/useFeatureFlagsSettled"
import { FeatureFlags } from "@/common/feature_flags"
import EducatorFlagGate from "./EducatorFlagGate"

jest.mock("@/common/useFeatureFlagsSettled", () => ({
  useFeatureFlagsSettled: jest.fn(),
}))

jest.mock("@/common/useFeatureFlag")

const mockUseFeatureFlag = jest.mocked(useFeatureFlag)
const mockUseFeatureFlagsSettled = jest.mocked(useFeatureFlagsSettled)
const mockNotFound = jest.mocked(notFound)

describe("EducatorFlagGate", () => {
  test("renders children when the feature flag is enabled", () => {
    mockUseFeatureFlagsSettled.mockReturnValue(true)
    mockUseFeatureFlag.mockReturnValue(true)
    renderWithProviders(
      <EducatorFlagGate>
        <div data-testid="gated-content">Gated content</div>
      </EducatorFlagGate>,
    )
    expect(screen.getByTestId("gated-content")).toBeInTheDocument()
    expect(mockUseFeatureFlag).toHaveBeenCalledWith(FeatureFlags.EducatorPage)
    expect(mockNotFound).not.toHaveBeenCalled()
  })

  test("renders nothing while the feature flags have not settled", () => {
    mockUseFeatureFlagsSettled.mockReturnValue(false)
    mockUseFeatureFlag.mockReturnValue(false)
    renderWithProviders(
      <EducatorFlagGate>
        <div data-testid="gated-content">Gated content</div>
      </EducatorFlagGate>,
    )
    expect(screen.queryByTestId("gated-content")).not.toBeInTheDocument()
    expect(mockNotFound).not.toHaveBeenCalled()
  })

  test("calls notFound when the flag is disabled and flags have settled", () => {
    allowConsoleErrors()
    mockNotFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND")
    })
    mockUseFeatureFlagsSettled.mockReturnValue(true)
    mockUseFeatureFlag.mockReturnValue(false)
    expect(() =>
      renderWithProviders(
        <EducatorFlagGate>
          <div data-testid="gated-content">Gated content</div>
        </EducatorFlagGate>,
      ),
    ).toThrow("NEXT_NOT_FOUND")
    expect(mockNotFound).toHaveBeenCalled()
    expect(screen.queryByTestId("gated-content")).not.toBeInTheDocument()
  })
})
