import { renderWithProviders, screen } from "@/test-utils"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { notFound } from "next/navigation"
import { allowConsoleErrors } from "ol-test-utilities"
import ArithmixClient from "./ArithmixClient"

jest.mock("mynumbers", () => ({
  __esModule: true,
  Arithmix: () => <div data-testid="arithmix">Arithmix Game</div>,
}))

const mockUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)
const mockNotFound = jest.mocked(notFound)

describe("ArithmixClient", () => {
  test("renders the Arithmix component when the feature flag is enabled", async () => {
    mockUseFeatureFlagEnabled.mockReturnValue(true)
    renderWithProviders(<ArithmixClient />)
    expect(await screen.findByTestId("arithmix")).toBeInTheDocument()
  })

  test("renders nothing while the feature flag is loading", () => {
    mockUseFeatureFlagEnabled.mockReturnValue(undefined)
    renderWithProviders(<ArithmixClient />)
    expect(screen.queryByTestId("arithmix")).not.toBeInTheDocument()
  })

  test("calls notFound when the feature flag is disabled", () => {
    allowConsoleErrors()
    mockNotFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND")
    })
    mockUseFeatureFlagEnabled.mockReturnValue(false)
    expect(() => renderWithProviders(<ArithmixClient />)).toThrow(
      "NEXT_NOT_FOUND",
    )
    expect(mockNotFound).toHaveBeenCalled()
  })
})
