import React from "react"
import { renderWithProviders, screen } from "@/test-utils"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { notFound } from "next/navigation"
import { allowConsoleErrors } from "ol-test-utilities"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import OrganizationalLearningFlagGate from "./OrganizationalLearningFlagGate"

jest.mock("@/common/useFeatureFlagsLoaded", () => ({
  useFeatureFlagsLoaded: jest.fn(),
}))

jest.mock("posthog-js/react")

const mockUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)
const mockUseFeatureFlagsLoaded = jest.mocked(useFeatureFlagsLoaded)
const mockNotFound = jest.mocked(notFound)

const renderGate = () =>
  renderWithProviders(
    <OrganizationalLearningFlagGate>
      <div data-testid="gated-content">Gated content</div>
    </OrganizationalLearningFlagGate>,
  )

describe("OrganizationalLearningFlagGate", () => {
  test("renders children when the feature flag is enabled", () => {
    mockUseFeatureFlagsLoaded.mockReturnValue(true)
    mockUseFeatureFlagEnabled.mockReturnValue(true)

    renderGate()

    expect(screen.getByTestId("gated-content")).toBeInTheDocument()
    expect(mockNotFound).not.toHaveBeenCalled()
  })

  test("renders nothing, and does not 404, while flags are still loading", () => {
    mockUseFeatureFlagsLoaded.mockReturnValue(false)
    mockUseFeatureFlagEnabled.mockReturnValue(undefined)

    renderGate()

    // The distinction that matters: an unloaded flag must not be read as
    // "disabled", or the page 404s for users who should see it.
    expect(screen.queryByTestId("gated-content")).not.toBeInTheDocument()
    expect(mockNotFound).not.toHaveBeenCalled()
  })

  test("calls notFound when the flag is disabled and flags have loaded", () => {
    allowConsoleErrors()
    mockNotFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND")
    })
    mockUseFeatureFlagsLoaded.mockReturnValue(true)
    mockUseFeatureFlagEnabled.mockReturnValue(false)

    expect(renderGate).toThrow("NEXT_NOT_FOUND")
    expect(mockNotFound).toHaveBeenCalled()
    expect(screen.queryByTestId("gated-content")).not.toBeInTheDocument()
  })
})
