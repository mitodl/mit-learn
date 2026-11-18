import React from "react"
import { renderWithProviders, screen } from "@/test-utils"
import { useFeatureFlag } from "@/common/useFeatureFlag"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import Page, { metadata } from "./page"

jest.mock("@/common/useFeatureFlagsLoaded", () => ({
  useFeatureFlagsLoaded: jest.fn(),
}))
jest.mock("@/common/useFeatureFlag")

describe("support page.tsx", () => {
  test("renders the Support page when the flag is on", () => {
    jest.mocked(useFeatureFlagsLoaded).mockReturnValue(true)
    jest.mocked(useFeatureFlag).mockReturnValue(true)
    renderWithProviders(<Page />)
    screen.getByRole("heading", { level: 1, name: "Support free education." })
  })

  test("renders nothing until the flags have loaded", () => {
    jest.mocked(useFeatureFlagsLoaded).mockReturnValue(false)
    jest.mocked(useFeatureFlag).mockReturnValue(false)
    renderWithProviders(<Page />)
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()
  })

  test("sets the title and description metadata", () => {
    expect(String(metadata.title)).toContain("Support free education")
    expect(metadata.description).toBe(
      "Help MIT keep high-quality educational resources available to learners everywhere.",
    )
  })
})
